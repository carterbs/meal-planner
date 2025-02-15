package models

import (
	"database/sql"
	"errors"
	"time"

	"github.com/lib/pq"
)

type Meal struct {
	ID             int          `json:"id"`
	MealName       string       `json:"mealName"`
	RelativeEffort int          `json:"relativeEffort"`
	LastPlanned    time.Time    `json:"lastPlanned"`
	RedMeat        bool         `json:"redMeat"`
	Ingredients    []Ingredient `json:"ingredients"`
}

// MealColumns defines the column names for Meal queries.
var MealColumns = []string{"id", "meal_name", "relative_effort", "last_planned", "red_meat"}

// MealsQueryFragment is the common fragment for querying meals along with ingredients.
const MealsQueryFragment = `
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
`

// GetMealsByIDsQuery is the query used to retrieve meals (and their ingredients) for specific meal IDs.
const GetMealsByIDsQuery = MealsQueryFragment + `
	WHERE m.id = ANY($1);
`

// GetAllMealsQuery is the query used to retrieve all meals (and their ingredients).
const GetAllMealsQuery = MealsQueryFragment + `;`

// GetRandomMealExcludingQuery is used to retrieve a random meal excluding the provided meal id.
const GetRandomMealExcludingQuery = MealsQueryFragment + `
	WHERE m.id != $1
	ORDER BY RANDOM()
	LIMIT 1;
`

// processMealRows converts the SQL rows into a slice of Meal pointers.
func processMealRows(rows *sql.Rows) ([]*Meal, error) {
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

	var meals []*Meal
	for _, meal := range mealsMap {
		meals = append(meals, meal)
	}
	return meals, nil
}

// GetMealsByIDs retrieves meals (including their ingredients) from the database for the given meal IDs.
func GetMealsByIDs(db *sql.DB, ids []int) ([]*Meal, error) {
	rows, err := db.Query(GetMealsByIDsQuery, pq.Array(ids))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return processMealRows(rows)
}

// GetAllMeals retrieves all meals (with their ingredients) from the database.
func GetAllMeals(db *sql.DB) ([]*Meal, error) {
	rows, err := db.Query(GetAllMealsQuery)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return processMealRows(rows)
}

// SwapMeal returns a random meal that is not the current meal.
func SwapMeal(currentMealID int, db *sql.DB) (*Meal, error) {
	rows, err := db.Query(GetRandomMealExcludingQuery, currentMealID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	meals, err := processMealRows(rows)
	if err != nil {
		return nil, err
	}
	if len(meals) == 0 {
		return nil, errors.New("no alternative meal found")
	}
	return meals[0], nil
}
