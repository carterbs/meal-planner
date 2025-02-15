package handlers

import (
	"encoding/json"
	"net/http"

	"mealplanner/models"
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
