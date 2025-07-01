package handlers

import (
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"mealplanner/dummy"
	"mealplanner/models"
	"mealplanner/services"

	"github.com/go-chi/chi/v5"
)

// UseDummy indicates whether the server is running with in-memory data
var UseDummy bool

// WorkflowService is the service instance for workflow operations
var WorkflowService services.WorkflowService

// attachShoppingList populates plan.ShoppingList by querying ingredients for all
// meals referenced in the plan.
func attachShoppingList(plan *models.WeeklyMealPlan) {
	if UseDummy {
		plan.ShoppingList = nil
		return
	}
	mealIDs := []int{}
	for _, d := range plan.Days {
		if d.Meal != nil {
			mealIDs = append(mealIDs, d.Meal.ID)
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
	if UseDummy {
		meals, err = dummy.GetAllMeals()
	} else if Services != nil && Services.MealService != nil {
		// Use service layer for real database operations
		meals, err = Services.MealService.GetAllMeals()
	} else {
		// Fallback to direct DB access for backward compatibility
		meals, err = models.GetAllMeals(DB)
	}
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
		return strings.ToLower(meals[i].MealName) < strings.ToLower(meals[j].MealName)
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(meals)
}

// RemoveMealHandler handles POST /api/meals/remove and removes a meal from the user's meal plan.
func RemoveMealHandler(w http.ResponseWriter, r *http.Request) {
	// Parse payload
	var payload struct {
		ThreadID string `json:"threadId"`
		DayIndex int    `json:"dayIndex"`
		MealType string `json:"mealType"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}
	if payload.ThreadID == "" {
		http.Error(w, "Missing threadId", http.StatusBadRequest)
		return
	}

	// Ensure workflow service is available
	if WorkflowService == nil {
		http.Error(w, "Workflow service not initialized", http.StatusInternalServerError)
		return
	}

	// Load meal plan using service
	plan, err := WorkflowService.GetMealPlan(payload.ThreadID)
	if err != nil {
		http.Error(w, "Failed to fetch meal plan: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Validate and remove the meal from the plan
	if err := models.RemoveMealFromPlan(plan, payload.DayIndex, payload.MealType); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Recompute / attach shopping list for response
	attachShoppingList(plan)

	// Save updated plan using service
	if err := WorkflowService.UpdateMealPlan(payload.ThreadID, plan); err != nil {
		http.Error(w, "Failed to update meal plan: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(plan)
}

// removeMealFromDay sets the specified meal type to nil for a DayMealPlan

// SwapMealHandler handles POST /api/meals/swap and returns a new meal to replace the current one.
func SwapMealHandler(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		MealID   int    `json:"meal_id"`
		MealType string `json:"meal_type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	var newMeal *models.Meal
	var err error
	if UseDummy {
		// Note: dummy implementation doesn't support meal type filtering
		newMeal, err = models.SwapMeal(payload.MealID, payload.MealType, DB)
	} else if Services != nil && Services.MealService != nil {
		// Use service layer for real database operations
		newMeal, err = Services.MealService.SwapMeal(payload.MealID, payload.MealType)
	} else {
		// Fallback to direct DB access for backward compatibility
		newMeal, err = models.SwapMeal(payload.MealID, payload.MealType, DB)
	}
	if err != nil {
		http.Error(w, "Error swapping meal: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(newMeal)
}

// UpdateMealIngredientHandler handles updating a single ingredient for a specific meal.
func UpdateMealIngredientHandler(w http.ResponseWriter, r *http.Request) {
	if UseDummy {
		http.Error(w, "Not implemented in dummy mode", http.StatusNotImplemented)
		return
	}
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

	var updatedIngredient models.Ingredient
	if err := json.NewDecoder(r.Body).Decode(&updatedIngredient); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	updatedIngredient.ID = ingredientID

	err = models.UpdateMealIngredient(DB, mealID, updatedIngredient)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	meals, err := models.GetMealsByIDs(DB, []int{mealID})
	if err != nil || len(meals) == 0 {
		http.Error(w, "Meal not found", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(meals[0])
}

// DeleteMealIngredientHandler handles DELETE /api/meals/{mealId}/ingredients/{ingredientId} and deletes a specific ingredient.
func DeleteMealIngredientHandler(w http.ResponseWriter, r *http.Request) {
	if UseDummy {
		http.Error(w, "Not implemented in dummy mode", http.StatusNotImplemented)
		return
	}
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

	// Delete the ingredient by its ID.
	err = models.DeleteMealIngredient(DB, ingredientID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Retrieve the meal to return the updated record.
	mealIdStr := chi.URLParam(r, "mealId")
	mealID, err := strconv.Atoi(mealIdStr)
	if err != nil {
		http.Error(w, "Invalid meal ID", http.StatusBadRequest)
		return
	}
	updatedMeals, err := models.GetMealsByIDs(DB, []int{mealID})
	if err != nil || len(updatedMeals) == 0 {
		http.Error(w, "Meal not found after deletion", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updatedMeals[0])
}

// DeleteMealHandler handles DELETE /api/meals/{mealId} and deletes a meal and its ingredients.
func DeleteMealHandler(w http.ResponseWriter, r *http.Request) {
	if UseDummy {
		http.Error(w, "Not implemented in dummy mode", http.StatusNotImplemented)
		return
	}
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

	err = models.DeleteMeal(DB, mealID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// ReplaceMealHandler handles POST /api/meals/replace and returns a new meal to replace the current one.
func ReplaceMealHandler(w http.ResponseWriter, r *http.Request) {
	if UseDummy {
		http.Error(w, "Not implemented in dummy mode", http.StatusNotImplemented)
		return
	}
	var payload struct {
		Day       string `json:"day"`
		NewMealID int    `json:"new_meal_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	meals, err := models.GetMealsByIDs(DB, []int{payload.NewMealID})
	if err != nil || len(meals) == 0 {
		http.Error(w, "Meal not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(meals[0])
}

// FinalizeMealPlanHandler handles POST /api/mealplan/finalize and updates the last planned date for all meals in the plan
func FinalizeMealPlanHandler(w http.ResponseWriter, r *http.Request) {
	if UseDummy {
		// In dummy mode, nothing to finalize
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Plan finalized"))
		return
	}
	var plan models.WeeklyMealPlan
	if err := json.NewDecoder(r.Body).Decode(&plan); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Extract meal IDs from the plan
	var mealIDs []int
	for _, d := range plan.Days {
		if d.Meal != nil && d.Meal.ID != 0 {
			mealIDs = append(mealIDs, d.Meal.ID)
		}
	}

	// Sort meal IDs to ensure consistent order
	sort.Ints(mealIDs)

	// Update last planned date for all meals in the plan
	err := models.UpdateLastPlannedDates(DB, mealIDs)
	if err != nil {
		http.Error(w, "Failed to finalize meal plan: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Meal plan finalized successfully."))
}

// CreateMealHandler handles POST /api/meals and creates a new meal with ingredients.
func CreateMealHandler(w http.ResponseWriter, r *http.Request) {
	if UseDummy {
		http.Error(w, "Not implemented in dummy mode", http.StatusNotImplemented)
		return
	}
	var meal models.Meal
	if err := json.NewDecoder(r.Body).Decode(&meal); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Validate the meal data
	if meal.MealName == "" {
		http.Error(w, "Meal name is required", http.StatusBadRequest)
		return
	}

	// Create the meal in the database
	createdMeal, err := models.CreateMeal(DB, meal)
	if err != nil {
		http.Error(w, "Error creating meal: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Return the created meal with the assigned IDs
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(createdMeal)
}
