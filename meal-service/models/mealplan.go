package models

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	apipb "mealplanner/generated/go"
	"mealplanner/logging"

	"go.uber.org/zap"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// PlanDay is an alias to the generated protobuf type
type PlanDay = apipb.MealPlanEntry

// WeeklyMealPlan is an alias to the generated protobuf type
type WeeklyMealPlan = apipb.WeeklyMealPlan

func getMealPlanServiceLogger() *zap.SugaredLogger {
	return logging.GetGrpcLogger("meal-plan-service")
}

// GenerateWeeklyMealPlan generates a weekly plan with breakfast, lunch, and dinner.
func GenerateWeeklyMealPlan(db *sql.DB) (*WeeklyMealPlan, error) {
	plan := &WeeklyMealPlan{Days: make([]*PlanDay, 0, 21)}
	redMeatUsed := false
	threeWeeksAgo := time.Now().AddDate(0, 0, -21)

	dayNames := DaysOfTheWeek
	mealTypes := []string{"breakfast", "lunch", "dinner"}

	for i, day := range dayNames {
		for _, mealType := range mealTypes {
			var minEffort, maxEffort int
			switch mealType {
			case "breakfast":
				minEffort, maxEffort = 0, 2
			case "lunch":
				minEffort, maxEffort = 0, 2
			case "dinner":
				minEffort, maxEffort = 3, 5
				if day == "Monday" {
					minEffort, maxEffort = 0, 2
				} else if day == "Sunday" {
					minEffort, maxEffort = 4, 10
				}
			}

			meal, err := pickMeal(db, minEffort, maxEffort, redMeatUsed, threeWeeksAgo, mealType)
			if err != nil {
				return nil, fmt.Errorf("failed picking %s for %s: %w", mealType, day, err)
			}
			if mealType == "dinner" && meal != nil && meal.GetHasRedMeat() {
				redMeatUsed = true
			}
			//log the day that we're adding to the plan
			if meal != nil {
				getMealPlanServiceLogger().Debugw("Adding meal to plan with dayIndex", "dayIndex", int32(i), "mealName", meal.Name)
			} else {
				getMealPlanServiceLogger().Debugw("Adding nil meal to plan with dayIndex", "dayIndex", int32(i))
			}

			plan.Days = append(plan.Days, &apipb.MealPlanEntry{Meal: meal, DayIndex: int32(i), MealType: mealType})
		}
	}

	// Overwrite Friday dinner to "Eating out"
	for idx := range plan.Days {
		if plan.Days[idx].DayIndex == 4 && plan.Days[idx].MealType == "dinner" {
			plan.Days[idx].Meal = &Meal{Name: "Eating out"}
			break
		}
	}

	// log dayIndex for the 8th meal
	getMealPlanServiceLogger().Debugw("In the model, 8th meal", "dayIndex", plan.Days[7].DayIndex)

	if logging.IsVerbose() {
		// DEBUGGING: Log all dayIndex values after generation
		getMealPlanServiceLogger().Infow("🔍 [BACKEND] GenerateWeeklyMealPlan complete - dayIndex values:")
		for i, day := range plan.Days {
			getMealPlanServiceLogger().Infow("🔍 [BACKEND] Meal entry", "index", i, "dayIndex", day.DayIndex, "mealType", day.MealType, "mealName", func() string {
				if day.Meal != nil {
					return day.Meal.Name
				}
				return "nil"
			}())
		}
	}

	return plan, nil
}

// buildPickMealQuery returns the SQL query for selecting a meal.
// It appends an extra condition if excludeRedMeat is true.
func buildPickMealQuery(excludeRedMeat bool, _ string) string {
	columns := strings.Join(MealColumns, ", ")
	query := "SELECT " + columns + " FROM meals WHERE relative_effort BETWEEN $1 AND $2 AND (last_planned IS NULL OR last_planned < $3) AND meal_type = $4"
	if excludeRedMeat {
		query += " AND red_meat = false"
	}
	return query + " ORDER BY random() LIMIT 1;"
}

// pickMeal selects one meal from the database that meets the provided criteria:
// - The meal's effort is between minEffort and maxEffort (inclusive)
// - The meal has not been planned in the last 3 weeks (last_planned is either NULL or older than cutoff)
// - If excludeRedMeat is true, only meals with red_meat = false are eligible.
// - Filters by meal_type.
// The function orders the results randomly and returns the first matching meal.
func pickMeal(db *sql.DB, minEffort, maxEffort int, excludeRedMeat bool, cutoff time.Time, mealType string) (*Meal, error) {
	query := buildPickMealQuery(excludeRedMeat, mealType)

	row := db.QueryRow(query, minEffort, maxEffort, cutoff, mealType)
	var m Meal
	var id int32
	var name string
	var effort int32
	var lastPlanned sql.NullTime
	var hasRedMeat bool
	var url sql.NullString
	var mealTypeScanned string
	err := row.Scan(&id, &name, &effort, &lastPlanned, &hasRedMeat, &url, &mealTypeScanned)

	m.Id = id
	m.Name = name
	m.Effort = effort
	m.HasRedMeat = hasRedMeat
	m.MealType = mealTypeScanned
	m.LastPlanned = nil
	if url.Valid {
		m.Url = url.String
	}
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// It's okay to not find a meal (e.g., no breakfasts in DB). Return nil.
			return nil, nil
		}
		return nil, err
	}
	if lastPlanned.Valid {
		m.LastPlanned = timestamppb.New(lastPlanned.Time)
	}

	return &m, nil
}

// GetLastPlannedMeals retrieves the most recently planned meals to reconstruct the last meal plan
func GetLastPlannedMeals(db *sql.DB) (*WeeklyMealPlan, error) {
	plan := &WeeklyMealPlan{Days: make([]*PlanDay, 0, 21)}
	// Friday is now included for breakfast and lunch, but dinner is always "Eating out"
	weekdays := DaysOfTheWeek
	numMealsNeeded := len(weekdays)

	lastBreakfasts, err := getLastPlannedMealsByType(db, "breakfast", numMealsNeeded)
	if err != nil {
		return nil, fmt.Errorf("failed to get last planned breakfasts: %w", err)
	}

	lastLunches, err := getLastPlannedMealsByType(db, "lunch", numMealsNeeded)
	if err != nil {
		return nil, fmt.Errorf("failed to get last planned lunches: %w", err)
	}

	lastDinners, err := getLastPlannedMealsByType(db, "dinner", numMealsNeeded)
	if err != nil {
		return nil, fmt.Errorf("failed to get last planned dinners: %w", err)
	}

	// If we don't have enough meals for each type, it's better to generate a fresh plan.
	if len(lastBreakfasts) < numMealsNeeded || len(lastLunches) < numMealsNeeded || len(lastDinners) < numMealsNeeded {
		return nil, errors.New("not enough recently planned meals to reconstruct a full plan")
	}

	for i := range weekdays {
		plan.Days = append(plan.Days, &apipb.MealPlanEntry{DayIndex: int32(i), MealType: "breakfast", Meal: lastBreakfasts[i]}, &apipb.MealPlanEntry{DayIndex: int32(i), MealType: "lunch", Meal: lastLunches[i]}, &apipb.MealPlanEntry{DayIndex: int32(i), MealType: "dinner", Meal: lastDinners[i]})
	}

	for idx := range plan.Days {
		if plan.Days[idx].DayIndex == 4 && plan.Days[idx].MealType == "dinner" {
			plan.Days[idx].Meal = &Meal{Name: "Eating out"}
			break
		}
	}

	return plan, nil
}

// getLastPlannedMealsByType is a helper function to retrieve the most recently planned meals of a specific type.
func getLastPlannedMealsByType(db *sql.DB, mealType string, limit int) ([]*Meal, error) {
	query := `SELECT ` + strings.Join(MealColumns, ", ") + `
		FROM meals
		WHERE meal_type = $1 AND last_planned IS NOT NULL
		ORDER BY last_planned DESC
		LIMIT $2`

	rows, err := db.Query(query, mealType, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var meals []*Meal
	for rows.Next() {
		var m Meal
		var id int32
		var name string
		var effort int32
		var lastPlanned sql.NullTime
		var hasRedMeat bool
		var url sql.NullString
		var mealTypeScanned string
		err := rows.Scan(&id, &name, &effort, &lastPlanned, &hasRedMeat, &url, &mealTypeScanned)
		if err != nil {
			return nil, err
		}

		m.Id = id
		m.Name = name
		m.Effort = effort
		m.HasRedMeat = hasRedMeat
		m.MealType = mealTypeScanned
		m.LastPlanned = nil
		if lastPlanned.Valid {
			m.LastPlanned = timestamppb.New(lastPlanned.Time)
		}

		if url.Valid {
			m.Url = url.String
		}
		meals = append(meals, &m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	// Reverse the slice to get the meals in chronological order (oldest of the batch first)
	for i, j := 0, len(meals)-1; i < j; i, j = i+1, j-1 {
		meals[i], meals[j] = meals[j], meals[i]
	}
	return meals, nil
}

// RemoveMealFromPlan sets the specified meal slot to nil in the weekly plan.
// dayIndex should be 0=Monday .. 6=Sunday. mealType should be breakfast, lunch, or dinner.
func RemoveMealFromPlan(plan *WeeklyMealPlan, dayIndex int, mealType string) error {
	if plan == nil {
		return errors.New("plan is nil")
	}
	if dayIndex < 0 || dayIndex > 6 {
		return fmt.Errorf("invalid dayIndex %d", dayIndex)
	}
	mealType = strings.ToLower(mealType)
	if mealType != "breakfast" && mealType != "lunch" && mealType != "dinner" {
		return fmt.Errorf("invalid mealType %s", mealType)
	}

	for i := range plan.Days {
		d := plan.Days[i]
		if int(d.DayIndex) == dayIndex && d.MealType == mealType {
			if d.Meal == nil {
				return errors.New("meal already empty")
			}
			d.Meal = nil
			return nil
		}
	}
	return fmt.Errorf("meal not found for dayIndex %d and mealType %s", dayIndex, mealType)
}
