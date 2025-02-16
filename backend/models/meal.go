package models

import (
	"database/sql"
	"errors"
	"log"
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
		mi.id AS ingredient_id,
		mi.name,
		CASE WHEN mi.quantity = '' THEN NULL ELSE mi.quantity::numeric END AS quantity,
		mi.unit
	FROM meals m
	LEFT JOIN ingredients mi ON m.id = mi.meal_id
`

// GetMealsByIDsQuery is the query used to retrieve meals (and their ingredients) for specific meal IDs.
const GetMealsByIDsQuery = `
	SELECT
		m.id,
		m.meal_name,
		m.relative_effort,
		m.last_planned,
		m.red_meat,
		mi.id AS ingredient_id,
		mi.name,
		CASE WHEN mi.quantity = '' THEN NULL ELSE mi.quantity::numeric END AS quantity,
		mi.unit
	FROM meals m
	LEFT JOIN ingredients mi ON m.id = mi.meal_id
	WHERE m.id = ANY($1)
	ORDER BY m.id, mi.id;
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
	var meals []*Meal
	for rows.Next() {
		var (
			mealID         int
			mealName       string
			relativeEffort int
			nt             sql.NullTime // scan as sql.NullTime
			redMeat        bool
			ingredientID   sql.NullInt64 // using sql.NullInt64 since a meal may have 0 ingredients
			ingredientName sql.NullString
			quantity       sql.NullFloat64
			unit           sql.NullString
		)
		err := rows.Scan(&mealID, &mealName, &relativeEffort, &nt, &redMeat,
			&ingredientID, &ingredientName, &quantity, &unit)
		if err != nil {
			log.Printf("processMealRows: error scanning row (mealID=%d): %v", mealID, err)
			return nil, err
		}

		// Find or create the meal object
		var m *Meal
		for _, meal := range meals {
			if meal.ID == mealID {
				m = meal
				break
			}
		}
		if m == nil {
			var lp time.Time
			if nt.Valid {
				lp = nt.Time
			} else {
				lp = time.Time{}
			}
			m = &Meal{
				ID:             mealID,
				MealName:       mealName,
				RelativeEffort: relativeEffort,
				LastPlanned:    lp,
				RedMeat:        redMeat,
				Ingredients:    []Ingredient{},
			}
			meals = append(meals, m)
		}

		// Only add ingredient if ingredientID is valid (not NULL)
		if ingredientID.Valid {
			ing := Ingredient{
				ID:       int(ingredientID.Int64),
				Name:     ingredientName.String,
				Quantity: quantity.Float64,
				Unit:     unit.String,
			}
			m.Ingredients = append(m.Ingredients, ing)
		}
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return meals, nil
}

// GetMealsByIDs retrieves meals (including their ingredients) from the database for the given meal IDs.
func GetMealsByIDs(db *sql.DB, ids []int) ([]*Meal, error) {
	rows, err := db.Query(GetMealsByIDsQuery, pq.Array(ids))
	if err != nil {
		log.Printf("GetMealsByIDs: error executing query: %v", err)
		return nil, err
	}
	defer rows.Close()
	return processMealRows(rows)
}

// GetAllMeals retrieves all meals (with their ingredients) from the database.
func GetAllMeals(db *sql.DB) ([]*Meal, error) {
	rows, err := db.Query(GetAllMealsQuery)
	if err != nil {
		log.Printf("GetAllMeals: error executing query: %v", err)
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

// UpdateMealIngredient updates a single ingredient for the specified meal using its ID.
func UpdateMealIngredient(db *sql.DB, mealID int, ingredient Ingredient) error {
	if ingredient.ID == 0 {
		err := errors.New("ingredient ID not provided")
		log.Printf("UpdateMealIngredient: %v (mealID=%d, ingredient=%+v)", err, mealID, ingredient)
		return err
	}

	res, err := db.Exec("UPDATE ingredients SET name=$1, quantity=$2, unit=$3 WHERE id=$4 AND meal_id=$5",
		ingredient.Name, ingredient.Quantity, ingredient.Unit, ingredient.ID, mealID)
	if err != nil {
		log.Printf("UpdateMealIngredient: error executing update (mealID=%d, ingredientID=%d): %v", mealID, ingredient.ID, err)
		return err
	}
	rowsAffected, _ := res.RowsAffected()
	log.Printf("UpdateMealIngredient: updated ingredientID=%d in mealID=%d, rowsAffected=%d", ingredient.ID, mealID, rowsAffected)
	return nil
}

// DeleteMealIngredient deletes an ingredient by its ID.
func DeleteMealIngredient(db *sql.DB, ingredientID int) error {
	result, err := db.Exec("DELETE FROM ingredients WHERE id = $1", ingredientID)
	if err != nil {
		log.Printf("DeleteMealIngredient: error executing delete for ingredientID=%d: %v", ingredientID, err)
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		log.Printf("DeleteMealIngredient: error getting rows affected for ingredientID=%d: %v", ingredientID, err)
		return err
	}
	if rowsAffected == 0 {
		err := errors.New("ingredient not found")
		log.Printf("DeleteMealIngredient: %v for ingredientID=%d", err, ingredientID)
		return err
	}
	log.Printf("DeleteMealIngredient: deleted ingredientID=%d, rowsAffected=%d", ingredientID, rowsAffected)
	return nil
}

// DeleteMeal deletes a meal and its ingredients by ID.
func DeleteMeal(db *sql.DB, mealID int) error {
	// Start a transaction since we need to delete from multiple tables
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Delete ingredients first due to foreign key constraint
	_, err = tx.Exec("DELETE FROM ingredients WHERE meal_id = $1", mealID)
	if err != nil {
		return err
	}

	// Delete the meal
	result, err := tx.Exec("DELETE FROM meals WHERE id = $1", mealID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return errors.New("meal not found")
	}

	return tx.Commit()
}
