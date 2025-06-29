package models

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

type DayMealPlan struct {
	Breakfast *Meal `json:"Breakfast"`
	Lunch     *Meal `json:"Lunch"`
	Dinner    *Meal `json:"Dinner"`
}

type WeeklyMealPlan struct {
	Monday    DayMealPlan `json:"Monday"`
	Tuesday   DayMealPlan `json:"Tuesday"`
	Wednesday DayMealPlan `json:"Wednesday"`
	Thursday  DayMealPlan `json:"Thursday"`
	Friday    DayMealPlan `json:"Friday"`
	Saturday  DayMealPlan `json:"Saturday"`
	Sunday    DayMealPlan `json:"Sunday"`
}

// GenerateWeeklyMealPlan generates a weekly plan with breakfast, lunch, and dinner.
func GenerateWeeklyMealPlan(db *sql.DB) (*WeeklyMealPlan, error) {
	plan := &WeeklyMealPlan{}
	redMeatUsed := false
	threeWeeksAgo := time.Now().AddDate(0, 0, -21)

	days := []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}

	for _, day := range days {
		var dayPlan DayMealPlan
		var err error

		// Breakfast: Low effort
		dayPlan.Breakfast, err = pickMeal(db, 0, 2, false, threeWeeksAgo, "breakfast")
		if err != nil {
			return nil, fmt.Errorf("failed picking breakfast for %s: %w", day, err)
		}

		// Lunch: Low effort
		dayPlan.Lunch, err = pickMeal(db, 0, 2, false, threeWeeksAgo, "lunch")
		if err != nil {
			return nil, fmt.Errorf("failed picking lunch for %s: %w", day, err)
		}

		// Dinner: Existing logic
		minEffort, maxEffort := 3, 5 // Default for Tue-Thu, Sat
		if day == "Monday" {
			minEffort, maxEffort = 0, 2
		} else if day == "Sunday" {
			minEffort, maxEffort = 4, 10
		}

		dayPlan.Dinner, err = pickMeal(db, minEffort, maxEffort, redMeatUsed, threeWeeksAgo, "dinner")
		if err != nil {
			// If we fail to get a dinner, it might be because of red meat restriction.
			// The old logic would just fail. Here we can be more robust if needed, but for now, we fail.
			return nil, fmt.Errorf("failed picking dinner for %s: %w", day, err)
		}
		if dayPlan.Dinner != nil && dayPlan.Dinner.RedMeat {
			redMeatUsed = true
		}

		switch day {
		case "Monday":
			plan.Monday = dayPlan
		case "Tuesday":
			plan.Tuesday = dayPlan
		case "Wednesday":
			plan.Wednesday = dayPlan
		case "Thursday":
			plan.Thursday = dayPlan
		case "Friday":
			plan.Friday = dayPlan
		case "Saturday":
			plan.Saturday = dayPlan
		case "Sunday":
			plan.Sunday = dayPlan
		}
	}

	// Overwrite Friday dinner to "Eating out"
	plan.Friday.Dinner = &Meal{
		MealName: "Eating out",
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
	var lastPlanned sql.NullTime
	var url sql.NullString
	err := row.Scan(&m.ID, &m.MealName, &m.RelativeEffort, &lastPlanned, &m.RedMeat, &url, &m.MealType)
	if url.Valid {
		m.URL = url.String
	}
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// It's okay to not find a meal (e.g., no breakfasts in DB). Return nil.
			return nil, nil
		}
		return nil, err
	}
	if lastPlanned.Valid {
		m.LastPlanned = lastPlanned.Time
	} else {
		m.LastPlanned = time.Time{}
	}
	return &m, nil
}

// GetLastPlannedMeals retrieves the most recently planned meals to reconstruct the last meal plan
func GetLastPlannedMeals(db *sql.DB) (*WeeklyMealPlan, error) {
	plan := &WeeklyMealPlan{}
	// Friday is now included for breakfast and lunch, but dinner is always "Eating out"
	weekdays := []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
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

	dayMap := map[string]*DayMealPlan{
		"Monday":    &plan.Monday,
		"Tuesday":   &plan.Tuesday,
		"Wednesday": &plan.Wednesday,
		"Thursday":  &plan.Thursday,
		"Friday":    &plan.Friday,
		"Saturday":  &plan.Saturday,
		"Sunday":    &plan.Sunday,
	}

	for i, day := range weekdays {
		dayPlan := dayMap[day]
		dayPlan.Breakfast = lastBreakfasts[i]
		dayPlan.Lunch = lastLunches[i]
		dayPlan.Dinner = lastDinners[i]
	}

	// Overwrite Friday dinner to "Eating out"
	plan.Friday.Dinner = &Meal{MealName: "Eating out"}

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
		var lastPlanned sql.NullTime
		var url sql.NullString
		err := rows.Scan(&m.ID, &m.MealName, &m.RelativeEffort, &lastPlanned, &m.RedMeat, &url, &m.MealType)
		if err != nil {
			return nil, err
		}
		if lastPlanned.Valid {
			m.LastPlanned = lastPlanned.Time
		}
		if url.Valid {
			m.URL = url.String
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
	weekDays := []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
	dayPlans := map[string]DayMealPlan{
		"Monday":    plan.Monday,
		"Tuesday":   plan.Tuesday,
		"Wednesday": plan.Wednesday,
		"Thursday":  plan.Thursday,
		"Friday":    plan.Friday,
		"Saturday":  plan.Saturday,
		"Sunday":    plan.Sunday,
	}

	var b strings.Builder
	b.WriteString("BEGIN:VCALENDAR\r\n")
	b.WriteString("VERSION:2.0\r\n")
	b.WriteString("PRODID:-//Meal Planner//EN\r\n")

	for i, day := range weekDays {
		dayPlan := dayPlans[day]
		meals := map[string]*Meal{
			"Breakfast": dayPlan.Breakfast,
			"Lunch":     dayPlan.Lunch,
			"Dinner":    dayPlan.Dinner,
		}

		for mealType, meal := range meals {
			if meal == nil || meal.MealName == "" {
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
				continue // Should not happen for known meal types
			}

			eventDate := monday.AddDate(0, 0, i)
			startTime := time.Date(eventDate.Year(), eventDate.Month(), eventDate.Day(), startHour, startMinute, 0, 0, time.UTC)
			endTime := startTime.Add(30 * time.Minute)

			b.WriteString("BEGIN:VEVENT\r\n")
			b.WriteString("DTSTAMP:" + time.Now().UTC().Format("20060102T150405Z") + "\r\n")
			b.WriteString("UID:" + fmt.Sprintf("%d-%s-%s@mealplanner", meal.ID, mealType, startTime.Format("20060102T150405Z")) + "\r\n")
			b.WriteString("DTSTART:" + startTime.Format("20060102T150405Z") + "\r\n")
			b.WriteString("DTEND:" + endTime.Format("20060102T150405Z") + "\r\n")
			b.WriteString("SUMMARY:" + escapeICSString(fmt.Sprintf("%s: %s", meal.MealName, mealType)) + "\r\n")
			if meal.URL != "" {
				b.WriteString("URL:" + meal.URL + "\r\n")
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

	var day *DayMealPlan
	switch dayIndex {
	case 0:
		day = &plan.Monday
	case 1:
		day = &plan.Tuesday
	case 2:
		day = &plan.Wednesday
	case 3:
		day = &plan.Thursday
	case 4:
		day = &plan.Friday
	case 5:
		day = &plan.Saturday
	case 6:
		day = &plan.Sunday
	}

	switch mealType {
	case "breakfast":
		if day.Breakfast == nil {
			return errors.New("meal already empty")
		}
		day.Breakfast = nil
	case "lunch":
		if day.Lunch == nil {
			return errors.New("meal already empty")
		}
		day.Lunch = nil
	case "dinner":
		if day.Dinner == nil {
			return errors.New("meal already empty")
		}
		day.Dinner = nil
	}
	return nil
}
