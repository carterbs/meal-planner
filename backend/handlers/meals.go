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
