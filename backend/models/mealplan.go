package models

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

// GenerateWeeklyMealPlan generates a weekly plan as a map from day to Meal pointer.
// It uses different effort thresholds for each day, avoids repeating a meal in the last 3 weeks,
// and only allows at most one red meat selection during the week.
func GenerateWeeklyMealPlan(db *sql.DB) (map[string]*Meal, error) {
	plan := make(map[string]*Meal)
	redMeatUsed := false
	threeWeeksAgo := time.Now().AddDate(0, 0, -21)

	// Monday: Low effort (e.g., effort 0-2)
	mondayMeal, err := pickMeal(db, 0, 2, redMeatUsed, threeWeeksAgo)
	if err != nil {
		return nil, errors.New("failed picking Monday meal: " + err.Error())
	}
	plan["Monday"] = mondayMeal
	if mondayMeal.RedMeat {
		redMeatUsed = true
	}

	// Tuesday: Low-medium effort (e.g., effort 3 to 5)
	tuesdayMeal, err := pickMeal(db, 3, 5, redMeatUsed, threeWeeksAgo)
	if err != nil {
		return nil, errors.New("failed picking Tuesday meal: " + err.Error())
	}
	plan["Tuesday"] = tuesdayMeal
	if tuesdayMeal.RedMeat {
		redMeatUsed = true
	}

	// Wednesday: Low-medium effort (range: 3-5)
	wednesdayMeal, err := pickMeal(db, 3, 5, redMeatUsed, threeWeeksAgo)
	if err != nil {
		return nil, errors.New("failed picking Wednesday meal: " + err.Error())
	}
	plan["Wednesday"] = wednesdayMeal
	if wednesdayMeal.RedMeat {
		redMeatUsed = true
	}

	// Thursday: Low-medium effort (range: 3-5)
	thursdayMeal, err := pickMeal(db, 3, 5, redMeatUsed, threeWeeksAgo)
	if err != nil {
		return nil, errors.New("failed picking Thursday meal: " + err.Error())
	}
	plan["Thursday"] = thursdayMeal
	if thursdayMeal.RedMeat {
		redMeatUsed = true
	}

	// Friday: Fixed "Eating out" value
	plan["Friday"] = &Meal{
		MealName: "Eating out",
	}

	// Saturday: Middle effort (using the same range as Tue-Thu)
	saturdayMeal, err := pickMeal(db, 3, 5, redMeatUsed, threeWeeksAgo)
	if err != nil {
		return nil, errors.New("failed picking Saturday meal: " + err.Error())
	}
	plan["Saturday"] = saturdayMeal
	if saturdayMeal.RedMeat {
		redMeatUsed = true
	}

	// Sunday: High effort (e.g., effort 6 to an arbitrarily high maximum)
	sundayMeal, err := pickMeal(db, 6, 100, redMeatUsed, threeWeeksAgo)
	if err != nil {
		return nil, errors.New("failed picking Sunday meal: " + err.Error())
	}
	plan["Sunday"] = sundayMeal
	// redMeatUsed update not needed for the last day

	return plan, nil
}

// buildPickMealQuery returns the SQL query for selecting a meal.
// It appends an extra condition if excludeRedMeat is true.
func buildPickMealQuery(excludeRedMeat bool) string {
	columns := strings.Join(MealColumns, ", ")
	query := "SELECT " + columns + " FROM meals WHERE relative_effort BETWEEN $1 AND $2 AND (last_planned IS NULL OR last_planned < $3)"
	if excludeRedMeat {
		query += " AND red_meat = false"
	}
	return query + " ORDER BY random() LIMIT 1;"
}

// pickMeal selects one meal from the database that meets the provided criteria:
// - The meal's effort is between minEffort and maxEffort (inclusive)
// - The meal has not been planned in the last 3 weeks (last_planned is either NULL or older than cutoff)
// - If excludeRedMeat is true, only meals with red_meat = false are eligible.
// The function orders the results randomly and returns the first matching meal.
func pickMeal(db *sql.DB, minEffort, maxEffort int, excludeRedMeat bool, cutoff time.Time) (*Meal, error) {
	query := buildPickMealQuery(excludeRedMeat)

	row := db.QueryRow(query, minEffort, maxEffort, cutoff)
	var m Meal
	var lastPlanned sql.NullTime
	var url sql.NullString
	err := row.Scan(&m.ID, &m.MealName, &m.RelativeEffort, &lastPlanned, &m.RedMeat, &url)
	if url.Valid {
		m.URL = url.String
	}
	if err != nil {
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
func GetLastPlannedMeals(db *sql.DB) (map[string]*Meal, error) {
	weekdays := []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
	plan := make(map[string]*Meal)

	// Query to get the 7 most recently planned meals
	query := `
		SELECT ` + strings.Join(MealColumns, ", ") + `
		FROM meals
		WHERE last_planned IS NOT NULL
		ORDER BY last_planned DESC
		LIMIT 7
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	dayIndex := 0

	for rows.Next() {
		var m Meal
		var lastPlanned sql.NullTime
		var url sql.NullString
		err := rows.Scan(&m.ID, &m.MealName, &m.RelativeEffort, &lastPlanned, &m.RedMeat, &url)
		if err != nil {
			return nil, err
		}

		if lastPlanned.Valid {
			m.LastPlanned = lastPlanned.Time
		}

		if url.Valid {
			m.URL = url.String
		}

		// Don't overwrite Friday's "Eating out" with a real meal
		if dayIndex < len(weekdays) && weekdays[dayIndex] != "Friday" {
			plan[weekdays[dayIndex]] = &m
		} else if dayIndex < len(weekdays) && weekdays[dayIndex] == "Friday" {
			// Set Friday to "Eating out"
			plan["Friday"] = &Meal{
				MealName: "Eating out",
			}
			// Process this meal for the next day
			if dayIndex+1 < len(weekdays) {
				plan[weekdays[dayIndex+1]] = &m
				dayIndex++
			}
		}

		dayIndex++
	}

	// If not enough meals were found, fill in Friday as "Eating out" if not already set
	if _, ok := plan["Friday"]; !ok {
		plan["Friday"] = &Meal{
			MealName: "Eating out",
		}
	}

	// If we didn't get a full meal plan, return an error so we can generate a new one
	if len(plan) < 6 {
		return nil, errors.New("not enough recently planned meals found")
	}

	return plan, nil
}

// MealPlanToICS generates an iCalendar representation of the meal plan starting from the provided monday date.
// Each meal becomes an all-day event with the meal name as the title.
func MealPlanToICS(plan map[string]*Meal, monday time.Time) string {
	monday = monday.UTC().Truncate(24 * time.Hour)
	weekDays := []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
	var b strings.Builder
	b.WriteString("BEGIN:VCALENDAR\r\n")
	b.WriteString("VERSION:2.0\r\n")
	b.WriteString("PRODID:-//Meal Planner//EN\r\n")
	for i, day := range weekDays {
		meal, ok := plan[day]
		if !ok || meal == nil {
			continue
		}
		eventDate := monday.AddDate(0, 0, i)
		b.WriteString("BEGIN:VEVENT\r\n")
		b.WriteString("DTSTAMP:" + time.Now().UTC().Format("20060102T150405Z") + "\r\n")
		b.WriteString("UID:" + fmt.Sprintf("%d-%s@mealplanner", meal.ID, eventDate.Format("20060102")) + "\r\n")
		b.WriteString("DTSTART;VALUE=DATE:" + eventDate.Format("20060102") + "\r\n")
		b.WriteString("SUMMARY:" + escapeICSString(meal.MealName) + "\r\n")
		if meal.URL != "" {
			b.WriteString("URL:" + meal.URL + "\r\n")
		}
		b.WriteString("END:VEVENT\r\n")
	}
	b.WriteString("END:VCALENDAR\r\n")
	return b.String()
}

// escapeICSString escapes commas and semicolons in strings to conform to the iCalendar format.
func escapeICSString(s string) string {
	replacer := strings.NewReplacer(",", "\\,", ";", "\\;", "\n", "\\n")
	return replacer.Replace(s)
}
