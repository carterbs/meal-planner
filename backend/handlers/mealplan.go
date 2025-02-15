package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"mealplanner/models"
)

// DB is a global database connection (set in main.go)
var DB *sql.DB

// GetMealPlan generates a weekly meal plan with effort levels.
// For this MVP, Friday is labeled "Eating out" and other days have dummy meal names.
func GetMealPlan(w http.ResponseWriter, r *http.Request) {
	plan, err := models.GenerateWeeklyMealPlan(DB)
	if err != nil {
		http.Error(w, "Error generating meal plan: "+err.Error(), http.StatusInternalServerError)
		return
	}
	// Create an output map from day to meal name
	output := make(map[string]string)
	for day, meal := range plan {
		output[day] = meal.MealName
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(output)
}

// FinalizeMealPlan finalizes the plan by updating each meal's last_planned timestamp.
func FinalizeMealPlan(w http.ResponseWriter, r *http.Request) {
	type FinalizePayload struct {
		Plan map[string]int `json:"plan"` // Map day -> meal ID
	}
	var payload FinalizePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	now := time.Now()
	for _, mealID := range payload.Plan {
		_, err := DB.Exec("UPDATE meals SET last_planned = $1 WHERE id = $2", now, mealID)
		if err != nil {
			log.Println("Error updating meal:", err)
			http.Error(w, "Internal error", http.StatusInternalServerError)
			return
		}
	}
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Meal plan finalized"))
}

// SwapMeal runs the recommendation algorithm for a specific day and returns a replacement meal.
func SwapMeal(w http.ResponseWriter, r *http.Request) {
	type SwapPayload struct {
		Day    string `json:"day"`
		MealID int    `json:"meal_id"` // ID of the current meal to be swapped
	}
	var payload SwapPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	// Here you would run your recommendation algorithm specific to the day.
	// For the MVP we return a dummy meal.
	newMeal := struct {
		Day       string `json:"day"`
		NewMealID int    `json:"new_meal_id"`
		MealName  string `json:"meal_name"`
	}{
		Day:       payload.Day,
		NewMealID: 999, // dummy replacement ID
		MealName:  "Dummy Replacement Meal",
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(newMeal)
}

// GetShoppingList returns all ingredients for the planned meals (no aggregation yet, per MVP).
func GetShoppingList(w http.ResponseWriter, r *http.Request) {
	// For now, we return a dummy static shopping list.
	shoppingList := []string{
		"1 cup unsalted butter",
		"4 flats of party rolls",
		"3 tablespoons yellow mustard",
		// Additional ingredients…
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(shoppingList)
}
