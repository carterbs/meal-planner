package models

import (
	"database/sql"
	"errors"

	apipb "mealplanner/generated/go"
	"mealplanner/logging"

	"github.com/lib/pq"
	"google.golang.org/protobuf/types/known/timestamppb"
)

var mealModelLogger = logging.GetGrpcLogger("meal-model")

// Meal is an alias to the generated protobuf type
type Meal = apipb.Meal

// MealColumns defines the column names for Meal queries.
var MealColumns = []string{"id", "meal_name", "relative_effort", "last_planned", "red_meat", "url", "meal_type"}

// MealsQueryFragment is the common fragment for querying meals along with ingredients.
const MealsQueryFragment = `
	SELECT
		m.id,
		m.meal_name,
		m.relative_effort,
		m.last_planned,
		m.red_meat,
		m.url,
		m.meal_type,
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
	WHERE m.id != $1 AND m.meal_type = $2
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
			mealType       string         // meal_type has a default, so it won't be NULL
			ingredientID   sql.NullInt64  // using sql.NullInt64 since a meal may have 0 ingredients
			ingredientName sql.NullString
			quantity       sql.NullFloat64
			unit           sql.NullString
		)
		err := rows.Scan(&mealID, &mealName, &relativeEffort, &nt, &redMeat, &url, &mealType,
			&ingredientID, &ingredientName, &quantity, &unit)
		if err != nil {
			mealModelLogger.Errorw("processMealRows: error scanning row", "mealID", mealID, "error", err)
			return nil, err
		}

		// Find or create the meal object
		var m *Meal
		for _, meal := range meals {
			if meal.GetId() == int32(mealID) {
				m = meal
				break
			}
		}
		if m == nil {
			urlValue := ""
			if url.Valid {
				urlValue = url.String
			}

			m = &Meal{
				Id:          int32(mealID),
				Name:        mealName,
				Effort:      int32(relativeEffort),
				HasRedMeat:  redMeat,
				Url:         urlValue,
				MealType:    mealType,
				Ingredients: []*Ingredient{},
				Steps:       []*Step{},
			}

			// Only set LastPlanned if the timestamp is valid
			if nt.Valid {
				m.LastPlanned = timestamppb.New(nt.Time)
			}
			meals = append(meals, m)
		}

		// Only add ingredient if ingredientID is valid (not NULL)
		if ingredientID.Valid {
			ing := &Ingredient{
				Id:       int32(ingredientID.Int64),
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
		mealModelLogger.Errorw("GetMealsByIDs: error executing query", "error", err)
		return nil, err
	}
	defer rows.Close()

	meals, err := processMealRows(rows)
	if err != nil {
		return nil, err
	}

	// Load steps for each meal
	for _, meal := range meals {
		steps, err := GetStepsForMeal(db, int(meal.GetId()))
		if err != nil {
			mealModelLogger.Errorw("GetMealsByIDs: error getting steps for meal", "mealID", meal.GetId(), "error", err)
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
		mealModelLogger.Errorw("GetAllMeals: error executing query", "error", err)
		return nil, err
	}
	defer rows.Close()

	meals, err := processMealRows(rows)
	if err != nil {
		return nil, err
	}

	// Load steps for each meal
	for _, meal := range meals {
		steps, err := GetStepsForMeal(db, int(meal.GetId()))
		if err != nil {
			mealModelLogger.Errorw("GetAllMeals: error getting steps for meal", "mealID", meal.GetId(), "error", err)
			continue // Skip steps if error, but don't fail the whole request
		}
		meal.Steps = steps
	}

	return meals, nil
}

// SwapMeal returns a random meal that is not the current meal.
func SwapMeal(currentMealID int, mealType string, db *sql.DB) (*Meal, error) {
	rows, err := db.Query(GetRandomMealExcludingQuery, currentMealID, mealType)
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
func UpdateMealIngredient(db *sql.DB, mealID int, ingredient *Ingredient) error {
	if ingredient.GetId() == 0 {
		err := errors.New("ingredient ID not provided")
		mealModelLogger.Errorw("UpdateMealIngredient: ingredient ID not provided", "mealID", mealID, "ingredient", ingredient)
		return err
	}

	res, err := db.Exec("UPDATE ingredients SET name=$1, quantity=$2, unit=$3 WHERE id=$4 AND meal_id=$5",
		ingredient.Name, ingredient.Quantity, ingredient.Unit, ingredient.GetId(), mealID)
	if err != nil {
		mealModelLogger.Errorw("UpdateMealIngredient: error executing update", "mealID", mealID, "ingredientID", ingredient.GetId(), "error", err)
		return err
	}
	rowsAffected, _ := res.RowsAffected()
	mealModelLogger.Debugw("UpdateMealIngredient: updated ingredient", "ingredientID", ingredient.GetId(), "mealID", mealID, "rowsAffected", rowsAffected)
	return nil
}

// DeleteMealIngredient deletes an ingredient by its ID.
func DeleteMealIngredient(db *sql.DB, ingredientID int) error {
	result, err := db.Exec("DELETE FROM ingredients WHERE id = $1", ingredientID)
	if err != nil {
		mealModelLogger.Errorw("DeleteMealIngredient: error executing delete", "ingredientID", ingredientID, "error", err)
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		mealModelLogger.Errorw("DeleteMealIngredient: error getting rows affected", "ingredientID", ingredientID, "error", err)
		return err
	}
	if rowsAffected == 0 {
		err := errors.New("ingredient not found")
		mealModelLogger.Errorw("DeleteMealIngredient: ingredient not found", "ingredientID", ingredientID)
		return err
	}
	mealModelLogger.Debugw("DeleteMealIngredient: deleted ingredient", "ingredientID", ingredientID, "rowsAffected", rowsAffected)
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
func CreateMeal(db *sql.DB, meal *Meal) (*Meal, error) {
	// Start a transaction
	tx, err := db.Begin()
	if err != nil {
		mealModelLogger.Errorw("CreateMeal: error starting transaction", "error", err)
		return nil, err
	}
	defer tx.Rollback()

	// Insert the meal
	var mealID int
	// Set default meal_type to "dinner" if not provided
	mealType := meal.GetMealType()
	if mealType == "" {
		mealType = "dinner"
	}
	err = tx.QueryRow(
		"INSERT INTO meals (meal_name, relative_effort, red_meat, url, meal_type) VALUES ($1, $2, $3, $4, $5) RETURNING id",
		meal.GetName(), meal.GetEffort(), meal.GetHasRedMeat(), meal.GetUrl(), mealType,
	).Scan(&mealID)
	if err != nil {
		mealModelLogger.Errorw("CreateMeal: error inserting meal", "error", err)
		return nil, err
	}
	meal.Id = int32(mealID)
	meal.MealType = mealType

	// Insert the ingredients
	for i := range meal.GetIngredients() {
		var ingredientID int
		err = tx.QueryRow(
			"INSERT INTO ingredients (meal_id, quantity, unit, name) VALUES ($1, $2, $3, $4) RETURNING id",
			mealID, meal.Ingredients[i].GetQuantity(), meal.Ingredients[i].GetUnit(), meal.Ingredients[i].GetName(),
		).Scan(&ingredientID)
		if err != nil {
			mealModelLogger.Errorw("CreateMeal: error inserting ingredient", "ingredientIndex", i, "error", err)
			return nil, err
		}
		meal.Ingredients[i].Id = int32(ingredientID)
		meal.Ingredients[i].MealId = int32(mealID)
	}

	// Insert the steps if any
	if len(meal.GetSteps()) > 0 {
		// Prepare statement for inserting steps
		stmtStep, err := tx.Prepare(`
			INSERT INTO recipe_steps (meal_id, step_number, instruction) 
			VALUES ($1, $2, $3) 
			RETURNING id
		`)
		if err != nil {
			mealModelLogger.Errorw("CreateMeal: error preparing statement for steps", "error", err)
			return nil, err
		}
		defer stmtStep.Close()

		for i := range meal.GetSteps() {
			var stepID int
			// Make sure step number is set correctly (1-indexed)
			meal.Steps[i].StepNumber = int32(i + 1)
			meal.Steps[i].MealId = int32(mealID)

			err = stmtStep.QueryRow(
				mealID, meal.Steps[i].GetStepNumber(), meal.Steps[i].GetInstruction(),
			).Scan(&stepID)
			if err != nil {
				mealModelLogger.Errorw("CreateMeal: error inserting step", "stepIndex", i, "error", err)
				return nil, err
			}
			meal.Steps[i].Id = int32(stepID)
		}
	}

	// Commit the transaction
	if err = tx.Commit(); err != nil {
		mealModelLogger.Errorw("CreateMeal: error committing transaction", "error", err)
		return nil, err
	}

	mealModelLogger.Debugw("CreateMeal: created meal", "mealID", mealID, "ingredientCount", len(meal.GetIngredients()), "stepCount", len(meal.GetSteps()))
	return meal, nil
}
