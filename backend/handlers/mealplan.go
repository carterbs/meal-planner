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
	// Create an output map from day to a simplified meal object.
	type OutputMeal struct {
		ID       int    `json:"id"`
		MealName string `json:"mealName"`
	}
	output := make(map[string]OutputMeal)
	for day, meal := range plan {
		output[day] = OutputMeal{
			ID:       meal.ID,
			MealName: meal.MealName,
		}
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

// SwapMeal handles swapping a meal in the current meal plan.
// It decodes the incoming payload, calls the real backend swap logic,
// and returns the new meal as JSON.
func SwapMeal(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Day    string `json:"day"`     // day of the meal plan (if needed)
		MealID int    `json:"meal_id"` // current meal ID
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

// GetShoppingList returns all ingredients for the planned meals (no aggregation yet, per MVP).
func GetShoppingList(w http.ResponseWriter, r *http.Request) {
	// Decode the plan payload from the frontend.
	type PlanPayload struct {
		Plan []int `json:"plan"` // array of meal IDs
	}
	var payload PlanPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	// Retrieve the meals for the provided IDs.
	meals, err := models.GetMealsByIDs(DB, payload.Plan)
	if err != nil {
		http.Error(w, "Error retrieving meals: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Log the retrieved meals.
	log.Printf("Retrieved meals for shopping list: %+v", meals)

	// Generate the shopping list from the retrieved meals.
	shoppingList := models.GenerateShoppingListFromMeals(meals)

	// Log the generated shopping list.
	log.Printf("Generated shopping list: %+v", shoppingList)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(shoppingList)
}
