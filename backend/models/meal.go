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
	URL            string       `json:"url"`
	Ingredients    []Ingredient `json:"ingredients"`
	Steps          []Step       `json:"steps,omitempty"`
}

// MealColumns defines the column names for Meal queries.
var MealColumns = []string{"id", "meal_name", "relative_effort", "last_planned", "red_meat", "url"}

// MealsQueryFragment is the common fragment for querying meals along with ingredients.
const MealsQueryFragment = `
	SELECT
		m.id,
		m.meal_name,
		m.relative_effort,
		m.last_planned,
		m.red_meat,
		m.url,
		mi.id AS ingredient_id,
		mi.name,
		CASE WHEN mi.quantity = '' THEN NULL ELSE mi.quantity::numeric END AS quantity,
		mi.unit
	FROM meals m
	LEFT JOIN ingredients mi ON m.id = mi.meal_id
`

// GetMealsByIDsQuery is the query used to retrieve meals (and their ingredients) for specific meal IDs.
const GetMealsByIDsQuery = MealsQueryFragment + `
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
			url            sql.NullString // URL could be NULL
			ingredientID   sql.NullInt64  // using sql.NullInt64 since a meal may have 0 ingredients
			ingredientName sql.NullString
			quantity       sql.NullFloat64
			unit           sql.NullString
		)
		err := rows.Scan(&mealID, &mealName, &relativeEffort, &nt, &redMeat, &url,
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

			urlValue := ""
			if url.Valid {
				urlValue = url.String
			}

			m = &Meal{
				ID:             mealID,
				MealName:       mealName,
				RelativeEffort: relativeEffort,
				LastPlanned:    lp,
				RedMeat:        redMeat,
				URL:            urlValue,
				Ingredients:    []Ingredient{},
				Steps:          []Step{},
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

	meals, err := processMealRows(rows)
	if err != nil {
		return nil, err
	}

	// Load steps for each meal
	for _, meal := range meals {
		steps, err := GetStepsForMeal(db, meal.ID)
		if err != nil {
			log.Printf("GetMealsByIDs: error getting steps for mealID=%d: %v", meal.ID, err)
			continue // Skip steps if error, but don't fail the whole request
		}
		meal.Steps = steps
	}

	return meals, nil
}

// GetAllMeals retrieves all meals (with their ingredients) from the database.
func GetAllMeals(db *sql.DB) ([]*Meal, error) {
	rows, err := db.Query(GetAllMealsQuery)
	if err != nil {
		log.Printf("GetAllMeals: error executing query: %v", err)
		return nil, err
	}
	defer rows.Close()

	meals, err := processMealRows(rows)
	if err != nil {
		return nil, err
	}

	// Load steps for each meal
	for _, meal := range meals {
		steps, err := GetStepsForMeal(db, meal.ID)
		if err != nil {
			log.Printf("GetAllMeals: error getting steps for mealID=%d: %v", meal.ID, err)
			continue // Skip steps if error, but don't fail the whole request
		}
		meal.Steps = steps
	}

	return meals, nil
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

	// Delete steps first (recipe_steps has a foreign key to meals)
	_, err = tx.Exec("DELETE FROM recipe_steps WHERE meal_id = $1", mealID)
	if err != nil {
		return err
	}

	// Delete ingredients (ingredients has a foreign key to meals)
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

// UpdateLastPlannedDates updates the last_planned date to current time for the given meal IDs
func UpdateLastPlannedDates(db *sql.DB, mealIDs []int) error {
	if len(mealIDs) == 0 {
		return nil
	}

	// Start a transaction
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Update last_planned date for all meals in the plan
	_, err = tx.Exec(`
		UPDATE meals 
		SET last_planned = NOW() 
		WHERE id = ANY($1)
	`, pq.Array(mealIDs))
	if err != nil {
		return err
	}

	return tx.Commit()
}

// CreateMeal inserts a new meal and its ingredients into the database
func CreateMeal(db *sql.DB, meal Meal) (*Meal, error) {
	// Start a transaction
	tx, err := db.Begin()
	if err != nil {
		log.Printf("CreateMeal: error starting transaction: %v", err)
		return nil, err
	}
	defer tx.Rollback()

	// Insert the meal
	var mealID int
	err = tx.QueryRow(
		"INSERT INTO meals (meal_name, relative_effort, red_meat, url) VALUES ($1, $2, $3, $4) RETURNING id",
		meal.MealName, meal.RelativeEffort, meal.RedMeat, meal.URL,
	).Scan(&mealID)
	if err != nil {
		log.Printf("CreateMeal: error inserting meal: %v", err)
		return nil, err
	}
	meal.ID = mealID

	// Insert the ingredients
	for i := range meal.Ingredients {
		var ingredientID int
		err = tx.QueryRow(
			"INSERT INTO ingredients (meal_id, quantity, unit, name) VALUES ($1, $2, $3, $4) RETURNING id",
			mealID, meal.Ingredients[i].Quantity, meal.Ingredients[i].Unit, meal.Ingredients[i].Name,
		).Scan(&ingredientID)
		if err != nil {
			log.Printf("CreateMeal: error inserting ingredient %d: %v", i, err)
			return nil, err
		}
		meal.Ingredients[i].ID = ingredientID
		meal.Ingredients[i].MealID = mealID
	}

	// Insert the steps if any
	if len(meal.Steps) > 0 {
		// Prepare statement for inserting steps
		stmtStep, err := tx.Prepare(`
			INSERT INTO recipe_steps (meal_id, step_number, instruction) 
			VALUES ($1, $2, $3) 
			RETURNING id
		`)
		if err != nil {
			log.Printf("CreateMeal: error preparing statement for steps: %v", err)
			return nil, err
		}
		defer stmtStep.Close()

		for i := range meal.Steps {
			var stepID int
			// Make sure step number is set correctly (1-indexed)
			meal.Steps[i].StepNumber = i + 1
			meal.Steps[i].MealID = mealID

			err = stmtStep.QueryRow(
				mealID, meal.Steps[i].StepNumber, meal.Steps[i].Instruction,
			).Scan(&stepID)
			if err != nil {
				log.Printf("CreateMeal: error inserting step %d: %v", i, err)
				return nil, err
			}
			meal.Steps[i].ID = stepID
		}
	}

	// Commit the transaction
	if err = tx.Commit(); err != nil {
		log.Printf("CreateMeal: error committing transaction: %v", err)
		return nil, err
	}

	log.Printf("CreateMeal: created meal with ID %d, %d ingredients, and %d steps",
		mealID, len(meal.Ingredients), len(meal.Steps))
	return &meal, nil
}
