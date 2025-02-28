package models

import (
	"database/sql"
	"errors"
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
