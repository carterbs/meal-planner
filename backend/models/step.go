package models

import (
	"database/sql"
	"errors"

	apipb "mealplanner/generated/go"
	"mealplanner/logging"
)

var stepModelLogger = logging.GetLogger("step-model")

// Step is an alias to the generated protobuf type
type Step = apipb.Step

// GetStepsForMeal retrieves all steps for a given meal ID, ordered by step number
func GetStepsForMeal(db *sql.DB, mealID int) ([]*Step, error) {
	rows, err := db.Query(`
		SELECT id, meal_id, step_number, instruction 
		FROM recipe_steps 
		WHERE meal_id = $1 
		ORDER BY step_number
	`, mealID)
	if err != nil {
		stepModelLogger.Errorw("GetStepsForMeal: error executing query", "mealID", mealID, "error", err)
		return nil, err
	}
	defer rows.Close()

	var steps []*Step
	for rows.Next() {
		var id, mealID, stepNumber int32
		var instruction string
		if err := rows.Scan(&id, &mealID, &stepNumber, &instruction); err != nil {
			stepModelLogger.Errorw("GetStepsForMeal: error scanning row", "mealID", mealID, "error", err)
			return nil, err
		}
		step := &apipb.Step{
			Id:          id,
			MealId:      mealID,
			StepNumber:  stepNumber,
			Instruction: instruction,
		}
		steps = append(steps, step)
	}

	if err := rows.Err(); err != nil {
		stepModelLogger.Errorw("GetStepsForMeal: error in row iteration", "mealID", mealID, "error", err)
		return nil, err
	}

	return steps, nil
}

// AddStepToMeal adds a new step to a meal
func AddStepToMeal(db *sql.DB, step *Step) (*Step, error) {
	// Check if meal exists
	var mealExists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM meals WHERE id = $1)", step.GetMealId()).Scan(&mealExists)
	if err != nil {
		stepModelLogger.Errorw("AddStepToMeal: error checking meal existence", "mealID", step.GetMealId(), "error", err)
		return nil, err
	}
	if !mealExists {
		return nil, errors.New("meal does not exist")
	}

	// If no step number is provided, find the next available one
	if step.GetStepNumber() <= 0 {
		var nextStepNumber int32
		err := db.QueryRow(`
			SELECT COALESCE(MAX(step_number), 0) + 1 
			FROM recipe_steps 
			WHERE meal_id = $1
		`, step.GetMealId()).Scan(&nextStepNumber)
		if err != nil {
			stepModelLogger.Errorw("AddStepToMeal: error determining next step number", "mealID", step.GetMealId(), "error", err)
			return nil, err
		}
		step.StepNumber = nextStepNumber
	}

	// Insert the new step
	var id int32
	err = db.QueryRow(`
		INSERT INTO recipe_steps (meal_id, step_number, instruction) 
		VALUES ($1, $2, $3) 
		RETURNING id
	`, step.GetMealId(), step.GetStepNumber(), step.GetInstruction()).Scan(&id)
	if err != nil {
		stepModelLogger.Errorw("AddStepToMeal: error inserting step", "mealID", step.GetMealId(), "error", err)
		return nil, err
	}
	step.Id = id

	return step, nil
}

// AddMultipleStepsToMeal adds multiple steps to a meal in a single transaction
func AddMultipleStepsToMeal(db *sql.DB, mealID int, instructions []string) ([]*Step, error) {
	if len(instructions) == 0 {
		return []*Step{}, nil
	}

	// Check if meal exists
	var mealExists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM meals WHERE id = $1)", mealID).Scan(&mealExists)
	if err != nil {
		stepModelLogger.Errorw("AddMultipleStepsToMeal: error checking meal existence", "mealID", mealID, "error", err)
		return nil, err
	}
	if !mealExists {
		return nil, errors.New("meal does not exist")
	}

	// Start a transaction
	tx, err := db.Begin()
	if err != nil {
		stepModelLogger.Errorw("AddMultipleStepsToMeal: error starting transaction", "mealID", mealID, "error", err)
		return nil, err
	}
	defer tx.Rollback()

	// Find starting step number
	var nextStepNumber int
	err = tx.QueryRow(`
		SELECT COALESCE(MAX(step_number), 0) + 1 
		FROM recipe_steps 
		WHERE meal_id = $1
	`, mealID).Scan(&nextStepNumber)
	if err != nil {
		stepModelLogger.Errorw("AddMultipleStepsToMeal: error determining next step number", "mealID", mealID, "error", err)
		return nil, err
	}

	// Prepare statement for inserting steps
	stmt, err := tx.Prepare(`
		INSERT INTO recipe_steps (meal_id, step_number, instruction) 
		VALUES ($1, $2, $3) 
		RETURNING id
	`)
	if err != nil {
		stepModelLogger.Errorw("AddMultipleStepsToMeal: error preparing statement", "mealID", mealID, "error", err)
		return nil, err
	}
	defer stmt.Close()

	// Insert each step
	steps := make([]*Step, len(instructions))
	for i, instruction := range instructions {
		stepNumber := nextStepNumber + i
		step := &Step{
			MealId:      int32(mealID),
			StepNumber:  int32(stepNumber),
			Instruction: instruction,
		}

		var stepID int32
		err = stmt.QueryRow(step.GetMealId(), step.GetStepNumber(), step.GetInstruction()).Scan(&stepID)
		if err != nil {
			stepModelLogger.Errorw("AddMultipleStepsToMeal: error inserting step", "stepIndex", i, "mealID", mealID, "error", err)
			return nil, err
		}

		step.Id = stepID
		steps[i] = step
	}

	// Commit the transaction
	if err = tx.Commit(); err != nil {
		stepModelLogger.Errorw("AddMultipleStepsToMeal: error committing transaction", "mealID", mealID, "error", err)
		return nil, err
	}

	return steps, nil
}

// UpdateStep updates an existing recipe step
func UpdateStep(db *sql.DB, step *Step) error {
	if step.GetId() == 0 {
		return errors.New("step ID not provided")
	}

	result, err := db.Exec(`
		UPDATE recipe_steps 
		SET step_number = $1, instruction = $2 
		WHERE id = $3 AND meal_id = $4
	`, step.GetStepNumber(), step.GetInstruction(), step.GetId(), step.GetMealId())
	if err != nil {
		stepModelLogger.Errorw("UpdateStep: error executing update", "stepID", step.GetId(), "mealID", step.GetMealId(), "error", err)
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		stepModelLogger.Errorw("UpdateStep: error getting rows affected", "stepID", step.GetId(), "error", err)
		return err
	}
	if rowsAffected == 0 {
		return errors.New("step not found")
	}

	return nil
}

// DeleteStep deletes a recipe step
func DeleteStep(db *sql.DB, stepID int, mealID int) error {
	result, err := db.Exec("DELETE FROM recipe_steps WHERE id = $1 AND meal_id = $2", stepID, mealID)
	if err != nil {
		stepModelLogger.Errorw("DeleteStep: error executing delete", "stepID", stepID, "mealID", mealID, "error", err)
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		stepModelLogger.Errorw("DeleteStep: error getting rows affected", "stepID", stepID, "error", err)
		return err
	}
	if rowsAffected == 0 {
		return errors.New("step not found")
	}

	return nil
}

// ReorderSteps updates the step_number for all steps of a meal
// The steps parameter should contain the step IDs in the desired order
func ReorderSteps(db *sql.DB, mealID int, stepIDs []int) error {
	if len(stepIDs) == 0 {
		return nil
	}

	// Start a transaction
	tx, err := db.Begin()
	if err != nil {
		stepModelLogger.Errorw("ReorderSteps: error starting transaction", "mealID", mealID, "error", err)
		return err
	}
	defer tx.Rollback()

	// First, set all step numbers to negative values to avoid unique constraint conflicts
	// This is a two-phase approach to avoid unique constraint violations
	stmt1, err := tx.Prepare(`
		UPDATE recipe_steps 
		SET step_number = -1 * step_number 
		WHERE id = $1 AND meal_id = $2
	`)
	if err != nil {
		stepModelLogger.Errorw("ReorderSteps: error preparing first statement", "mealID", mealID, "error", err)
		return err
	}
	defer stmt1.Close()

	// First phase: set all step numbers to negative
	for _, stepID := range stepIDs {
		_, err := stmt1.Exec(stepID, mealID)
		if err != nil {
			stepModelLogger.Errorw("ReorderSteps: error setting negative step number", "stepID", stepID, "mealID", mealID, "error", err)
			return err
		}
	}

	// Prepare statement for updating step numbers to their final values
	stmt2, err := tx.Prepare(`
		UPDATE recipe_steps 
		SET step_number = $1 
		WHERE id = $2 AND meal_id = $3
	`)
	if err != nil {
		stepModelLogger.Errorw("ReorderSteps: error preparing second statement", "mealID", mealID, "error", err)
		return err
	}
	defer stmt2.Close()

	// Second phase: update each step's number according to its position in the stepIDs slice
	for i, stepID := range stepIDs {
		stepNumber := i + 1 // steps are 1-indexed
		_, err := stmt2.Exec(stepNumber, stepID, mealID)
		if err != nil {
			stepModelLogger.Errorw("ReorderSteps: error updating step number", "stepID", stepID, "mealID", mealID, "error", err)
			return err
		}
	}

	// Commit the transaction
	if err = tx.Commit(); err != nil {
		stepModelLogger.Errorw("ReorderSteps: error committing transaction", "mealID", mealID, "error", err)
		return err
	}

	return nil
}

// DeleteAllStepsForMeal deletes all steps for a given meal
func DeleteAllStepsForMeal(db *sql.DB, mealID int) error {
	_, err := db.Exec("DELETE FROM recipe_steps WHERE meal_id = $1", mealID)
	if err != nil {
		stepModelLogger.Errorw("DeleteAllStepsForMeal: error executing delete", "mealID", mealID, "error", err)
		return err
	}
	return nil
}
