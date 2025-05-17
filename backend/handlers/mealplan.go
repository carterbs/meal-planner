package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"mealplanner/dummy"
	"mealplanner/models"
)

// DB is a global database connection (set in main.go)
var DB *sql.DB

// GetMealPlan retrieves a meal plan - either the last saved one or generates a new one if none exists.
func GetMealPlan(w http.ResponseWriter, r *http.Request) {
	// First try to get the last planned meals
	var plan map[string]*models.Meal
	var err error
	if UseDummy {
		plan, err = dummy.GenerateWeeklyMealPlan()
	} else {
		plan, err = models.GetLastPlannedMeals(DB)
		if err != nil {
			log.Printf("No recent meal plan found, generating new one: %v", err)
			plan, err = models.GenerateWeeklyMealPlan(DB)
			if err != nil {
				http.Error(w, "Error generating meal plan: "+err.Error(), http.StatusInternalServerError)
				return
			}
		}
	}

	// Create an output map from day to a simplified meal object including effort.
	type OutputMeal struct {
		ID             int    `json:"id"`
		MealName       string `json:"mealName"`
		RelativeEffort int    `json:"relativeEffort"`
		URL            string `json:"url,omitempty"`
	}
	output := make(map[string]OutputMeal)
	for day, meal := range plan {
		output[day] = OutputMeal{
			ID:             meal.ID,
			MealName:       meal.MealName,
			RelativeEffort: meal.RelativeEffort,
			URL:            meal.URL,
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(output)
}

// GenerateMealPlan generates a new weekly meal plan regardless of whether a recent one exists.
func GenerateMealPlan(w http.ResponseWriter, r *http.Request) {
	var plan map[string]*models.Meal
	var err error
	if UseDummy {
		plan, err = dummy.GenerateWeeklyMealPlan()
	} else {
		plan, err = models.GenerateWeeklyMealPlan(DB)
	}
	if err != nil {
		http.Error(w, "Error generating meal plan: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Create an output map from day to a simplified meal object including effort.
	type OutputMeal struct {
		ID             int    `json:"id"`
		MealName       string `json:"mealName"`
		RelativeEffort int    `json:"relativeEffort"`
		URL            string `json:"url,omitempty"`
	}
	output := make(map[string]OutputMeal)
	for day, meal := range plan {
		output[day] = OutputMeal{
			ID:             meal.ID,
			MealName:       meal.MealName,
			RelativeEffort: meal.RelativeEffort,
			URL:            meal.URL,
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(output)
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

	var newMeal *models.Meal
	var err error
	if UseDummy {
		newMeal, err = dummy.SwapMeal(payload.MealID)
	} else {
		newMeal, err = models.SwapMeal(payload.MealID, DB)
	}
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
	var meals []*models.Meal
	var err error
	if UseDummy {
		meals, err = dummy.GetMealsByIDs(payload.Plan)
	} else {
		meals, err = models.GetMealsByIDs(DB, payload.Plan)
	}
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
