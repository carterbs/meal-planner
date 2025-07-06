package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"mealplanner/logging"
	"mealplanner/models"
	"mealplanner/services"
)

// DB is a global database connection (set in main.go)
var DB *sql.DB

// Services is a global service container (set in main.go)
var Services *services.ServiceContainer

var mealplanHandlerLogger = logging.GetLogger("mealplan-handler")

// generateShoppingListForPlan populates plan.ShoppingList using meal IDs found
// in the plan. It fetches full meal details if needed and aggregates the
// ingredients.
func generateShoppingListForPlan(plan *models.WeeklyMealPlan) error {
	mealIDs := make([]int, 0)
	for _, d := range plan.Days {
		if d.Meal != nil {
			mealIDs = append(mealIDs, int(d.Meal.GetId()))
		}
	}
	if len(mealIDs) == 0 {
		plan.ShoppingList = nil
		return nil
	}

	items, err := buildShoppingList(mealIDs)
	if err != nil {
		return err
	}
	plan.ShoppingList = items
	return nil
}

// GetMealPlan retrieves a meal plan - either the last saved one or generates a new one if none exists.
func GetMealPlan(w http.ResponseWriter, r *http.Request) {
	// First try to get the last planned meals
	var plan *models.WeeklyMealPlan
	var err error
	// Use service layer for all database operations
	plan, err = Services.MealPlanService.GetLastPlannedMeals()
	if err != nil {
		mealplanHandlerLogger.Infow("No recent meal plan found, generating new one", "error", err)
		plan, err = Services.MealPlanService.GenerateWeeklyMealPlan()
		if err != nil {
			http.Error(w, "Error generating meal plan: "+err.Error(), http.StatusInternalServerError)
			return
		}
	}

	detailedPlan, err := Services.MealPlanService.PopulateMealDetails(plan)
	if err != nil {
		mealplanHandlerLogger.Errorw("Error fetching meals with ingredients", "error", err)
		http.Error(w, "Error fetching meal details: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if err := generateShoppingListForPlan(detailedPlan); err != nil {
		mealplanHandlerLogger.Errorw("Error generating shopping list", "error", err)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(detailedPlan)
}

// GenerateMealPlan generates a new weekly meal plan regardless of whether a recent one exists.
func GenerateMealPlan(w http.ResponseWriter, r *http.Request) {
	var plan *models.WeeklyMealPlan
	var err error
	// Use service layer for all database operations
	plan, err = Services.MealPlanService.GenerateWeeklyMealPlan()
	if err != nil {
		http.Error(w, "Error generating meal plan: "+err.Error(), http.StatusInternalServerError)
		return
	}

	detailedPlan, err := Services.MealPlanService.PopulateMealDetails(plan)
	if err != nil {
		mealplanHandlerLogger.Errorw("Error fetching meals with ingredients", "error", err)
		http.Error(w, "Error fetching meal details: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Handle skip_days by converting to a map and excluding skipped days

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(detailedPlan)
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

	items, err := buildShoppingList(payload.Plan)
	if err != nil {
		http.Error(w, "Error retrieving meals: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// buildShoppingList retrieves meals for the given IDs and returns the aggregated
// shopping list items.
func buildShoppingList(mealIDs []int) ([]models.ShoppingListItem, error) {
	// Use service layer for all database operations
	return Services.ShoppingListService.BuildShoppingList(mealIDs)
}

// AGENT-REFACTOR: split up the ICS and the meal plan stuff. they're two separate features
// MealPlanICSHandler returns the current meal plan as an iCalendar file.
func MealPlanICSHandler(w http.ResponseWriter, r *http.Request) {
	var plan *models.WeeklyMealPlan
	var err error
	// Use service layer for all database operations
	plan, err = Services.MealPlanService.GetLastPlannedMeals()
	if err != nil {
		plan, err = Services.MealPlanService.GenerateWeeklyMealPlan()
		if err != nil {
			http.Error(w, "Error generating meal plan: "+err.Error(), http.StatusInternalServerError)
			return
		}
	}
	monday := time.Now()
	for monday.Weekday() != time.Monday {
		monday = monday.AddDate(0, 0, -1)
	}
	ics := models.MealPlanToICS(plan, monday)
	w.Header().Set("Content-Type", "text/calendar")
	w.Header().Set("Content-Disposition", "attachment; filename=mealplan.ics")
	w.Write([]byte(ics))
}
