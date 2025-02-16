package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"mealplanner/models"

	"github.com/go-chi/chi/v5"
)

// GetAllMealsHandler handles GET /api/meals and returns all meals with their ingredients.
func GetAllMealsHandler(w http.ResponseWriter, r *http.Request) {
	meals, err := models.GetAllMeals(DB)
	if err != nil {
		http.Error(w, "Error retrieving meals: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(meals)
}

// SwapMealHandler handles POST /api/meals/swap and returns a new meal to replace the current one.
func SwapMealHandler(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		MealID int `json:"meal_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	newMeal, err := models.SwapMeal(payload.MealID, DB)
	if err != nil {
		http.Error(w, "Error swapping meal: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(newMeal)
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
	var payload struct {
		Plan map[string]models.Meal `json:"plan"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	// Extract meal IDs from the plan
	var mealIDs []int
	for _, meal := range payload.Plan {
		mealIDs = append(mealIDs, meal.ID)
	}

	// Update last planned date for all meals in the plan
	err := models.UpdateLastPlannedDates(DB, mealIDs)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Plan finalized"))
}
