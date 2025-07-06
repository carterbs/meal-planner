package models

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"
)

// PlanDay represents a single meal slot in the plan using the array based
// representation preferred by the agent workflow.
type PlanDay struct {
	Meal     *Meal  `json:"meal"`
	DayIndex int    `json:"dayIndex"` // 0=Monday .. 6=Sunday
	MealType string `json:"mealType"` // breakfast, lunch or dinner
}

// WeeklyMealPlan represents a week's worth of meals as a flat array of PlanDay
// entries.  This mirrors the structure produced and consumed by the agent.
type WeeklyMealPlan struct {
	Days         []PlanDay          `json:"days"`
	ShoppingList []ShoppingListItem `json:"shoppingList,omitempty"`
}

// GenerateWeeklyMealPlan generates a weekly plan with breakfast, lunch, and dinner.
func GenerateWeeklyMealPlan(db *sql.DB) (*WeeklyMealPlan, error) {
	plan := &WeeklyMealPlan{Days: make([]PlanDay, 0, 21)}
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
			plan.Days = append(plan.Days, PlanDay{Meal: meal, DayIndex: i, MealType: mealType})
		}
	}

	// Overwrite Friday dinner to "Eating out"
	for idx := range plan.Days {
		if plan.Days[idx].DayIndex == 4 && plan.Days[idx].MealType == "dinner" {
			plan.Days[idx].Meal = &Meal{Name: "Eating out"}
			break
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
	} else {
		m.LastPlanned = timestamppb.New(time.Time{})
	}
	return &m, nil
}

// GetLastPlannedMeals retrieves the most recently planned meals to reconstruct the last meal plan
func GetLastPlannedMeals(db *sql.DB) (*WeeklyMealPlan, error) {
	plan := &WeeklyMealPlan{Days: make([]PlanDay, 0, 21)}
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
		plan.Days = append(plan.Days,
			PlanDay{DayIndex: i, MealType: "breakfast", Meal: lastBreakfasts[i]},
			PlanDay{DayIndex: i, MealType: "lunch", Meal: lastLunches[i]},
			PlanDay{DayIndex: i, MealType: "dinner", Meal: lastDinners[i]},
		)
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

// MealPlanToICS generates an iCalendar representation of the meal plan starting from the provided monday date.
// Each meal becomes an all-day event with the meal name as the title.
func MealPlanToICS(plan *WeeklyMealPlan, monday time.Time) string {
	monday = monday.UTC().Truncate(24 * time.Hour)
	weekDays := DaysOfTheWeek
	// Build lookup maps for quick access
	mealsByDay := make(map[int]map[string]*Meal)
	for _, pd := range plan.Days {
		if _, ok := mealsByDay[pd.DayIndex]; !ok {
			mealsByDay[pd.DayIndex] = make(map[string]*Meal)
		}
		mealsByDay[pd.DayIndex][strings.Title(pd.MealType)] = pd.Meal
	}

	var b strings.Builder
	b.WriteString("BEGIN:VCALENDAR\r\n")
	b.WriteString("VERSION:2.0\r\n")
	b.WriteString("PRODID:-//Meal Planner//EN\r\n")

	for i := range weekDays {
		meals := mealsByDay[i]
		if meals == nil {
			continue
		}
		for mealType, meal := range meals {
			if meal == nil || meal.GetName() == "" {
				continue
			}

			var startHour, startMinute int
			switch mealType {
			case "Breakfast":
				startHour, startMinute = 7, 0
			case "Lunch":
				startHour, startMinute = 12, 0
			case "Dinner":
				startHour, startMinute = 18, 30
			default:
				continue
			}

			eventDate := monday.AddDate(0, 0, i)
			startTime := time.Date(eventDate.Year(), eventDate.Month(), eventDate.Day(), startHour, startMinute, 0, 0, time.UTC)
			endTime := startTime.Add(30 * time.Minute)

			b.WriteString("BEGIN:VEVENT\r\n")
			b.WriteString("DTSTAMP:" + time.Now().UTC().Format("20060102T150405Z") + "\r\n")
			b.WriteString("UID:" + fmt.Sprintf("%d-%s-%s@mealplanner", meal.GetId(), mealType, startTime.Format("20060102T150405Z")) + "\r\n")
			b.WriteString("DTSTART:" + startTime.Format("20060102T150405Z") + "\r\n")
			b.WriteString("DTEND:" + endTime.Format("20060102T150405Z") + "\r\n")
			b.WriteString("SUMMARY:" + escapeICSString(fmt.Sprintf("%s: %s", meal.GetName(), mealType)) + "\r\n")
			if meal.GetUrl() != "" {
				b.WriteString("URL:" + meal.GetUrl() + "\r\n")
			}
			b.WriteString("END:VEVENT\r\n")
		}
	}

	b.WriteString("END:VCALENDAR\r\n")
	return b.String()
}

// escapeICSString escapes commas and semicolons in strings to conform to the iCalendar format.
func escapeICSString(s string) string {
	replacer := strings.NewReplacer(",", "\\,", ";", "\\;", "\n", "\\n")
	return replacer.Replace(s)
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
		d := &plan.Days[i]
		if d.DayIndex == dayIndex && d.MealType == mealType {
			if d.Meal == nil {
				return errors.New("meal already empty")
			}
			d.Meal = nil
			return nil
		}
	}
	return fmt.Errorf("meal not found for dayIndex %d and mealType %s", dayIndex, mealType)
}

// BuildShoppingListFromPlan aggregates all ingredients referenced in the plan's
// meals and returns them as ShoppingListItem entries.
// The plan's Meal objects must include ingredient details.
func BuildShoppingListFromPlan(plan *WeeklyMealPlan) []ShoppingListItem {
	if plan == nil {
		return nil
	}
	meals := []*Meal{}
	for _, d := range plan.Days {
		if d.Meal != nil {
			meals = append(meals, d.Meal)
		}
	}
	ingredients := GenerateShoppingListFromMeals(meals)
	return ConvertIngredientsToShoppingItems(ingredients)
}
