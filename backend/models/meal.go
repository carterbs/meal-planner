package models

import (
	"database/sql"
	"time"

	"github.com/lib/pq"
)

type Meal struct {
	ID             int
	MealName       string       `json:"mealName"`
	RelativeEffort int          `json:"relativeEffort"`
	LastPlanned    time.Time    `json:"lastPlanned"`
	RedMeat        bool         `json:"redMeat"`
	Ingredients    []Ingredient `json:"ingredients"`
}

// MealColumns defines the column names for Meal queries.
var MealColumns = []string{"id", "meal_name", "relative_effort", "last_planned", "red_meat"}

// GetMealsByIDsQuery is the query used to retrieve meals (and their ingredients).
const GetMealsByIDsQuery = `
	SELECT
		m.id,
		m.meal_name,
		m.relative_effort,
		m.last_planned,
		m.red_meat,
		mi.name,
		CASE WHEN mi.quantity = '' THEN NULL ELSE mi.quantity::numeric END AS quantity,
		mi.unit
	FROM meals m
	LEFT JOIN ingredients mi ON m.id = mi.meal_id
	WHERE m.id = ANY($1);
`

// GetMealsByIDs retrieves meals (including their ingredients) from the database given a slice of meal IDs.
func GetMealsByIDs(db *sql.DB, ids []int) ([]*Meal, error) {
	rows, err := db.Query(GetMealsByIDsQuery, pq.Array(ids))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Use a map to group rows per meal.
	mealsMap := make(map[int]*Meal)
	for rows.Next() {
		var id int
		var mealName string
		var relativeEffort int
		var lastPlanned sql.NullTime
		var redMeat bool
		var inName sql.NullString
		var quantity sql.NullFloat64
		var unit sql.NullString

		if err := rows.Scan(&id, &mealName, &relativeEffort, &lastPlanned, &redMeat, &inName, &quantity, &unit); err != nil {
			return nil, err
		}

		// If we haven't seen this meal yet, create it.
		meal, exists := mealsMap[id]
		if !exists {
			meal = &Meal{
				ID:             id,
				MealName:       mealName,
				RelativeEffort: relativeEffort,
				RedMeat:        redMeat,
				Ingredients:    []Ingredient{},
			}
			if lastPlanned.Valid {
				meal.LastPlanned = lastPlanned.Time
			}
			mealsMap[id] = meal
		}

		// Append ingredient if present.
		if inName.Valid && inName.String != "" {
			ing := Ingredient{
				Name: inName.String,
			}
			if quantity.Valid {
				ing.Quantity = quantity.Float64
			}
			if unit.Valid {
				ing.Unit = unit.String
			}
			meal.Ingredients = append(meal.Ingredients, ing)
		}
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Convert mealsMap to a slice.
	var meals []*Meal
	for _, meal := range mealsMap {
		meals = append(meals, meal)
	}
	return meals, nil
}
