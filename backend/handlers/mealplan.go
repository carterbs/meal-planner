package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"mealplanner/dummy"
	"mealplanner/models"
)

// DB is a global database connection (set in main.go)
var DB *sql.DB

func populateMealDetails(plan *models.WeeklyMealPlan) (*models.WeeklyMealPlan, error) {
	mealIDs := make([]int, 0)
	days := []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
	dayPlans := map[string]models.DayMealPlan{
		"Monday":    plan.Monday,
		"Tuesday":   plan.Tuesday,
		"Wednesday": plan.Wednesday,
		"Thursday":  plan.Thursday,
		"Friday":    plan.Friday,
		"Saturday":  plan.Saturday,
		"Sunday":    plan.Sunday,
	}

	for _, day := range days {
		dayPlan := dayPlans[day]
		if dayPlan.Breakfast != nil && dayPlan.Breakfast.ID != 0 {
			mealIDs = append(mealIDs, dayPlan.Breakfast.ID)
		}
		if dayPlan.Lunch != nil && dayPlan.Lunch.ID != 0 {
			mealIDs = append(mealIDs, dayPlan.Lunch.ID)
		}
		if dayPlan.Dinner != nil && dayPlan.Dinner.ID != 0 {
			mealIDs = append(mealIDs, dayPlan.Dinner.ID)
		}
	}

	if len(mealIDs) == 0 {
		return plan, nil // No meals to populate
	}

	var mealsWithIngredients []*models.Meal
	var err error
	if UseDummy {
		mealsWithIngredients, err = dummy.GetMealsByIDs(mealIDs)
	} else {
		mealsWithIngredients, err = models.GetMealsByIDs(DB, mealIDs)
	}
	if err != nil {
		return nil, err
	}

	mealMap := make(map[int]*models.Meal)
	for _, meal := range mealsWithIngredients {
		mealMap[meal.ID] = meal
	}

	// Create a new plan to hold the populated meal details
	populatedPlan := *plan

	updateDayMealPlan := func(dayPlan *models.DayMealPlan) {
		if dayPlan.Breakfast != nil {
			if fullMeal, ok := mealMap[dayPlan.Breakfast.ID]; ok {
				dayPlan.Breakfast = fullMeal
			}
		}
		if dayPlan.Lunch != nil {
			if fullMeal, ok := mealMap[dayPlan.Lunch.ID]; ok {
				dayPlan.Lunch = fullMeal
			}
		}
		if dayPlan.Dinner != nil {
			if fullMeal, ok := mealMap[dayPlan.Dinner.ID]; ok {
				dayPlan.Dinner = fullMeal
			}
		}
	}

	updateDayMealPlan(&populatedPlan.Monday)
	updateDayMealPlan(&populatedPlan.Tuesday)
	updateDayMealPlan(&populatedPlan.Wednesday)
	updateDayMealPlan(&populatedPlan.Thursday)
	// Friday's meals might be nil or "Eating out"
	updateDayMealPlan(&populatedPlan.Friday)
	updateDayMealPlan(&populatedPlan.Saturday)
	updateDayMealPlan(&populatedPlan.Sunday)

	return &populatedPlan, nil
}

// GetMealPlan retrieves a meal plan - either the last saved one or generates a new one if none exists.
func GetMealPlan(w http.ResponseWriter, r *http.Request) {
	// First try to get the last planned meals
	var plan *models.WeeklyMealPlan
	var err error
	if UseDummy {
		// Use dummy data generation
		plan, err = dummy.GenerateWeeklyMealPlanStruct()
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

	detailedPlan, err := populateMealDetails(plan)
	if err != nil {
		log.Printf("Error fetching meals with ingredients: %v", err)
		http.Error(w, "Error fetching meal details: "+err.Error(), http.StatusInternalServerError)
		return
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
	} else {
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

		if !skipSet["Monday"] && detailedPlan.Monday.Dinner != nil {
			result["Monday"] = detailedPlan.Monday.Dinner
		}
		if !skipSet["Tuesday"] && detailedPlan.Tuesday.Dinner != nil {
			result["Tuesday"] = detailedPlan.Tuesday.Dinner
		}
		if !skipSet["Wednesday"] && detailedPlan.Wednesday.Dinner != nil {
			result["Wednesday"] = detailedPlan.Wednesday.Dinner
		}
		if !skipSet["Thursday"] && detailedPlan.Thursday.Dinner != nil {
			result["Thursday"] = detailedPlan.Thursday.Dinner
		}
		if !skipSet["Friday"] && detailedPlan.Friday.Dinner != nil {
			result["Friday"] = detailedPlan.Friday.Dinner
		}
		if !skipSet["Saturday"] && detailedPlan.Saturday.Dinner != nil {
			result["Saturday"] = detailedPlan.Saturday.Dinner
		}
		if !skipSet["Sunday"] && detailedPlan.Sunday.Dinner != nil {
			result["Sunday"] = detailedPlan.Sunday.Dinner
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
