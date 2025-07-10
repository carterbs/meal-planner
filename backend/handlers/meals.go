package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"google.golang.org/protobuf/encoding/protojson"

	apipb "mealplanner/generated/go"
	"mealplanner/models"
	"mealplanner/services"

	"github.com/go-chi/chi/v5"
)

// WorkflowService is the service instance for workflow operations
// toProtoWeeklyMealPlan converts internal model to protobuf WeeklyMealPlan
func toProtoWeeklyMealPlan(plan *models.WeeklyMealPlan) *apipb.WeeklyMealPlan {
	pb := &apipb.WeeklyMealPlan{Days: make([]*apipb.PlanDay, len(plan.Days))}
	for i, d := range plan.Days {
		pb.Days[i] = &apipb.PlanDay{Meal: d.Meal, DayIndex: int32(d.DayIndex), MealType: d.MealType}
	}
	pb.ShoppingList = make([]*apipb.ShoppingListItem, len(plan.ShoppingList))
	for i, item := range plan.ShoppingList {
		pb.ShoppingList[i] = &apipb.ShoppingListItem{Ingredient: item.Ingredient, Quantity: item.Quantity, Category: item.Category}
	}

	return pb
}

var WorkflowService services.WorkflowService

// attachShoppingList populates plan.ShoppingList by querying ingredients for all
// meals referenced in the plan.
func attachShoppingList(plan *models.WeeklyMealPlan) {
	mealIDs := []int{}
	for _, d := range plan.Days {
		if d.Meal != nil {
			mealIDs = append(mealIDs, int(d.Meal.GetId()))
		}
	}
	if len(mealIDs) == 0 {
		plan.ShoppingList = nil
		return
	}
	items, err := buildShoppingList(mealIDs)
	if err == nil {
		plan.ShoppingList = items
	}
}

// GetAllMealsHandler handles GET /api/meals and returns all meals with their ingredients.
// Supports optional query parameter "type" to filter by meal type (breakfast, lunch, dinner).
func GetAllMealsHandler(w http.ResponseWriter, r *http.Request) {
	var meals []*models.Meal
	var err error
	// Use service layer for all database operations
	meals, err = Services.MealService.GetAllMeals()
	if err != nil {
		http.Error(w, "Error retrieving meals: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Filter by meal type if specified
	mealType := r.URL.Query().Get("type")
	if mealType != "" {
		filteredMeals := []*models.Meal{}
		for _, meal := range meals {
			if meal.MealType == mealType {
				filteredMeals = append(filteredMeals, meal)
			}
		}
		meals = filteredMeals
	}

	// Sort meals alphabetically by name (A -> Z), case-insensitive
	sort.Slice(meals, func(i, j int) bool {
		return strings.ToLower(meals[i].GetName()) < strings.ToLower(meals[j].GetName())
	})

	w.Header().Set("Content-Type", "application/json")
	// Marshal and write meals response as proto JSON
	resp := &apipb.GetAllMealsResponse{Meals: meals}
	b, err := protojson.MarshalOptions{UseProtoNames: true}.Marshal(resp)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to marshal meals response: %v", err), http.StatusInternalServerError)
		return
	}
	w.Write(b)
}

// RemoveMealHandler handles POST /api/meals/remove and removes a meal from the user's meal plan.
func RemoveMealHandler(w http.ResponseWriter, r *http.Request) {
	if WorkflowService == nil {
		http.Error(w, "Workflow service not initialized", http.StatusInternalServerError)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}
	var req apipb.RemoveMealRequest
	if err := protojson.Unmarshal(body, &req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}
	if req.ThreadId == "" {
		http.Error(w, "Missing threadId", http.StatusBadRequest)
		return
	}

	plan, err := WorkflowService.GetMealPlan(req.ThreadId)
	if err != nil {
		http.Error(w, "Failed to fetch meal plan: "+err.Error(), http.StatusInternalServerError)
		return
	}
	// AGENT-REFACTOR: handlers should not interact with models. move it to the service layer.
	// Validate and remove the meal from the plan
	if err := models.RemoveMealFromPlan(plan, int(req.DayIndex), req.MealType); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Recompute / attach shopping list for response
	// AGENT-REFACTOR: we shouldn't have to attach shopping lists like this. If you swap a meal, remove a meal, or modify the workflow, it should return the latest data. Here, I'd expect that to come from the removeMealFromPlan function that will be moved to the service layer. I don't like how we're mixing responsibilities between the handler and the service layer. This handler removes a meal. it should just remove meals. delegate other responsibilities to the service layer.
	attachShoppingList(plan)

	// Save updated plan using service
	if err := WorkflowService.UpdateMealPlan(req.ThreadId, plan); err != nil {
		http.Error(w, "Failed to update meal plan: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	// Marshal and write updated plan response as proto JSON
	resp := &apipb.RemoveMealResponse{Plan: toProtoWeeklyMealPlan(plan)}
	b, err := protojson.MarshalOptions{UseProtoNames: true}.Marshal(resp)

	if err != nil {
		http.Error(w, fmt.Sprintf("failed to marshal updated plan response: %v", err), http.StatusInternalServerError)
		return
	}
	w.Write(b)
}

// SwapMealHandler handles POST /api/meals/swap and returns a new meal to replace the current one.
func SwapMealHandler(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}
	var req apipb.SwapMealRequest
	if err := protojson.Unmarshal(body, &req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	newMeal, err := Services.MealService.SwapMeal(int(req.MealId), req.MealType)
	if err != nil {
		http.Error(w, "Error swapping meal: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	// Marshal and write swap meal response as proto JSON
	b, err := protojson.MarshalOptions{UseProtoNames: true}.Marshal(newMeal)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to marshal swap meal response: %v", err), http.StatusInternalServerError)
		return
	}
	w.Write(b)
}

// UpdateMealIngredientHandler handles updating a single ingredient for a specific meal.
func UpdateMealIngredientHandler(w http.ResponseWriter, r *http.Request) {
	mealIdStr := chi.URLParam(r, "mealId")
	if mealIdStr == "" {
		http.Error(w, "Missing meal ID", http.StatusBadRequest)
		return
	}
	mealID, err := strconv.Atoi(mealIdStr)
	if err != nil {
		http.Error(w, "Invalid meal ID", http.StatusBadRequest)
		return
	}

	ingredientIdStr := chi.URLParam(r, "ingredientId")
	if ingredientIdStr == "" {
		http.Error(w, "Missing ingredient ID", http.StatusBadRequest)
		return
	}
	ingredientID, err := strconv.Atoi(ingredientIdStr)
	if err != nil {
		http.Error(w, "Invalid ingredient ID", http.StatusBadRequest)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}
	var updatedIngredient models.Ingredient
	if err := json.Unmarshal(body, &updatedIngredient); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	updatedIngredient.Id = int32(ingredientID)
	meal, err := Services.MealService.UpdateMealIngredient(mealID, &updatedIngredient)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	// Marshal and write update ingredient response as proto JSON
	resp := &apipb.UpdateMealIngredientResponse{Meal: meal}
	b, err := protojson.MarshalOptions{UseProtoNames: true}.Marshal(resp)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to marshal meal response: %v", err), http.StatusInternalServerError)
		return
	}
	w.Write(b)
}

// DeleteMealIngredientHandler handles DELETE /api/meals/{mealId}/ingredients/{ingredientId} and deletes a specific ingredient.
func DeleteMealIngredientHandler(w http.ResponseWriter, r *http.Request) {
	// Parse ingredientId from URL.
	ingredientIdStr := chi.URLParam(r, "ingredientId")
	if ingredientIdStr == "" {
		http.Error(w, "Missing ingredient ID", http.StatusBadRequest)
		return
	}
	ingredientID, err := strconv.Atoi(ingredientIdStr)
	if err != nil {
		http.Error(w, "Invalid ingredient ID", http.StatusBadRequest)
		return
	}
	// Delete the ingredient and get updated meal
	mealIdStr := chi.URLParam(r, "mealId")
	mealID, err := strconv.Atoi(mealIdStr)
	if err != nil {
		http.Error(w, "Invalid meal ID", http.StatusBadRequest)
		return
	}

	meal, err := Services.MealService.DeleteMealIngredient(mealID, ingredientID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	// Marshal and write delete ingredient response as proto JSON
	resp := &apipb.DeleteMealIngredientResponse{Meal: meal}
	b, err := protojson.MarshalOptions{UseProtoNames: true}.Marshal(resp)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to marshal meal response: %v", err), http.StatusInternalServerError)
		return
	}
	w.Write(b)
}

// DeleteMealHandler handles DELETE /api/meals/{mealId} and deletes a meal and its ingredients.
func DeleteMealHandler(w http.ResponseWriter, r *http.Request) {
	mealIdStr := chi.URLParam(r, "mealId")
	if mealIdStr == "" {
		http.Error(w, "Missing meal ID", http.StatusBadRequest)
		return
	}
	mealID, err := strconv.Atoi(mealIdStr)
	if err != nil {
		http.Error(w, "Invalid meal ID", http.StatusBadRequest)
		return
	}

	err = Services.MealService.DeleteMeal(mealID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// ReplaceMealHandler handles POST /api/meals/replace and returns a new meal to replace the current one.
func ReplaceMealHandler(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}
	var req apipb.ReplaceMealRequest
	if err := protojson.Unmarshal(body, &req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	meal, err := Services.MealService.GetMealByID(int(req.NewMealId))
	if err != nil {
		http.Error(w, "Meal not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	// Marshal and write meal response as proto JSON
	b, err := protojson.MarshalOptions{UseProtoNames: true}.Marshal(meal)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to marshal meal response: %v", err), http.StatusInternalServerError)
		return
	}
	w.Write(b)
}

// FinalizeMealPlanHandler handles POST /api/mealplan/finalize and updates the last planned date for all meals in the plan
func FinalizeMealPlanHandler(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}
	var plan models.WeeklyMealPlan
	if err := json.Unmarshal(body, &plan); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Extract meal IDs from the plan
	var mealIDs []int
	for _, d := range plan.Days {
		if d.Meal != nil && d.Meal.GetId() != 0 {
			mealIDs = append(mealIDs, int(d.Meal.GetId()))
		}
	}

	// Sort meal IDs to ensure consistent order
	sort.Ints(mealIDs)

	// Update last planned date for all meals in the plan
	updateErr := Services.MealService.UpdateLastPlannedDates(mealIDs)
	if updateErr != nil {
		http.Error(w, "Failed to finalize meal plan: "+updateErr.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Meal plan finalized successfully."))
}

// CreateMealHandler handles POST /api/meals and creates a new meal with ingredients.
func CreateMealHandler(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}
	var reqProto apipb.CreateMealRequest
	if err := protojson.Unmarshal(body, &reqProto); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}
	meal := reqProto.GetMeal()

	// Validate the meal data
	if meal.GetName() == "" {
		http.Error(w, "Meal name is required", http.StatusBadRequest)
		return
	}

	// Create the meal in the database
	createdMeal, err := Services.MealService.CreateMeal(meal)
	if err != nil {
		http.Error(w, "Error creating meal: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Return the created meal with the assigned IDs
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	// Marshal and write created meal response as proto JSON
	resp := &apipb.CreateMealResponse{Meal: createdMeal}
	b, err := protojson.MarshalOptions{UseProtoNames: true}.Marshal(resp)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to marshal created meal response: %v", err), http.StatusInternalServerError)
		return
	}
	w.Write(b)
}
