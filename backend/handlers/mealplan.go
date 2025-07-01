package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"mealplanner/dummy"
	"mealplanner/models"
	"mealplanner/services"
)

// DB is a global database connection (set in main.go)
var DB *sql.DB

// Services is a global service container (set in main.go)
var Services *services.ServiceContainer

func populateMealDetails(plan *models.WeeklyMealPlan) (*models.WeeklyMealPlan, error) {
	if UseDummy {
		// Use existing dummy implementation for backward compatibility
		mealIDs := make([]int, 0)
		for _, d := range plan.Days {
			if d.Meal != nil && d.Meal.ID != 0 {
				mealIDs = append(mealIDs, d.Meal.ID)
			}
		}

		if len(mealIDs) == 0 {
			return plan, nil // No meals to populate
		}

		mealsWithIngredients, err := dummy.GetMealsByIDs(mealIDs)
		if err != nil {
			return nil, err
		}

		mealMap := make(map[int]*models.Meal)
		for _, meal := range mealsWithIngredients {
			mealMap[meal.ID] = meal
		}

		populatedPlan := *plan
		for i := range populatedPlan.Days {
			d := &populatedPlan.Days[i]
			if d.Meal != nil {
				if fullMeal, ok := mealMap[d.Meal.ID]; ok {
					d.Meal = fullMeal
				}
			}
		}

		return &populatedPlan, nil
	}

	// Use service layer for real database operations
	if Services != nil && Services.MealPlanService != nil {
		return Services.MealPlanService.PopulateMealDetails(plan)
	}

	// Fallback to direct DB access for backward compatibility
	mealIDs := make([]int, 0)
	for _, d := range plan.Days {
		if d.Meal != nil && d.Meal.ID != 0 {
			mealIDs = append(mealIDs, d.Meal.ID)
		}
	}

	if len(mealIDs) == 0 {
		return plan, nil // No meals to populate
	}

	mealsWithIngredients, err := models.GetMealsByIDs(DB, mealIDs)
	if err != nil {
		return nil, err
	}

	mealMap := make(map[int]*models.Meal)
	for _, meal := range mealsWithIngredients {
		mealMap[meal.ID] = meal
	}

	populatedPlan := *plan
	for i := range populatedPlan.Days {
		d := &populatedPlan.Days[i]
		if d.Meal != nil {
			if fullMeal, ok := mealMap[d.Meal.ID]; ok {
				d.Meal = fullMeal
			}
		}
	}

	return &populatedPlan, nil
}

// generateShoppingListForPlan populates plan.ShoppingList using meal IDs found
// in the plan. It fetches full meal details if needed and aggregates the
// ingredients.
func generateShoppingListForPlan(plan *models.WeeklyMealPlan) error {
	mealIDs := make([]int, 0)
	for _, d := range plan.Days {
		if d.Meal != nil {
			mealIDs = append(mealIDs, d.Meal.ID)
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
	if UseDummy {
		// Use dummy data generation
		plan, err = dummy.GenerateWeeklyMealPlanStruct()
	} else if Services != nil && Services.MealPlanService != nil {
		// Use service layer for real database operations
		plan, err = Services.MealPlanService.GetLastPlannedMeals()
		if err != nil {
			log.Printf("No recent meal plan found, generating new one: %v", err)
			plan, err = Services.MealPlanService.GenerateWeeklyMealPlan()
			if err != nil {
				http.Error(w, "Error generating meal plan: "+err.Error(), http.StatusInternalServerError)
				return
			}
		}
	} else {
		// Fallback to direct DB access for backward compatibility
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

	detailedPlan, err := populateMealDetails(plan)
	if err != nil {
		log.Printf("Error fetching meals with ingredients: %v", err)
		http.Error(w, "Error fetching meal details: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if err := generateShoppingListForPlan(detailedPlan); err != nil {
		log.Printf("Error generating shopping list: %v", err)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(detailedPlan)
}

// GenerateMealPlan generates a new weekly meal plan regardless of whether a recent one exists.
func GenerateMealPlan(w http.ResponseWriter, r *http.Request) {
	var input struct {
		SkipDays []string `json:"skip_days"`
	}
	_ = json.NewDecoder(r.Body).Decode(&input)

	var plan *models.WeeklyMealPlan
	var err error
	if UseDummy {
		// Use dummy data generation
		plan, err = dummy.GenerateWeeklyMealPlanStruct()
	} else if Services != nil && Services.MealPlanService != nil {
		// Use service layer for real database operations
		plan, err = Services.MealPlanService.GenerateWeeklyMealPlan()
	} else {
		// Fallback to direct DB access for backward compatibility
		plan, err = models.GenerateWeeklyMealPlan(DB)
	}
	if err != nil {
		http.Error(w, "Error generating meal plan: "+err.Error(), http.StatusInternalServerError)
		return
	}

	detailedPlan, err := populateMealDetails(plan)
	if err != nil {
		log.Printf("Error fetching meals with ingredients: %v", err)
		http.Error(w, "Error fetching meal details: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Handle skip_days by converting to a map and excluding skipped days
	if len(input.SkipDays) > 0 {
		skipSet := make(map[string]bool)
		for _, day := range input.SkipDays {
			skipSet[day] = true
		}

		// Convert to map format and exclude skipped days
		result := make(map[string]interface{})
		dayNames := models.DaysOfTheWeek
		for _, pd := range detailedPlan.Days {
			if pd.MealType != "dinner" || pd.Meal == nil {
				continue
			}
			dayName := dayNames[pd.DayIndex]
			if !skipSet[dayName] {
				result[dayName] = pd.Meal
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	} else {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(detailedPlan)
	}
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
	if UseDummy {
		// Use existing dummy implementation for backward compatibility
		meals, err := dummy.GetMealsByIDs(mealIDs)
		if err != nil {
			return nil, err
		}
		ing := models.GenerateShoppingListFromMeals(meals)
		return models.ConvertIngredientsToShoppingItems(ing), nil
	}

	// Use service layer for real database operations
	if Services != nil && Services.ShoppingListService != nil {
		return Services.ShoppingListService.BuildShoppingList(mealIDs)
	}

	// Fallback to direct DB access for backward compatibility
	meals, err := models.GetMealsByIDs(DB, mealIDs)
	if err != nil {
		return nil, err
	}

	ing := models.GenerateShoppingListFromMeals(meals)
	return models.ConvertIngredientsToShoppingItems(ing), nil
}

// MealPlanICSHandler returns the current meal plan as an iCalendar file.
func MealPlanICSHandler(w http.ResponseWriter, r *http.Request) {
	var plan *models.WeeklyMealPlan
	var err error
	if UseDummy {
		plan, err = dummy.GenerateWeeklyMealPlanStruct()
	} else {
		plan, err = models.GetLastPlannedMeals(DB)
		if err != nil {
			plan, err = models.GenerateWeeklyMealPlan(DB)
			if err != nil {
				http.Error(w, "Error generating meal plan: "+err.Error(), http.StatusInternalServerError)
				return
			}
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
