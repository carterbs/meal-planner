package models

import (
	"database/sql"
	"errors"
	"log"
)

// Step represents a single instruction step in a recipe
type Step struct {
	ID          int    `json:"id"`
	MealID      int    `json:"mealId"`
	StepNumber  int    `json:"stepNumber"`
	Instruction string `json:"instruction"`
}

// GetStepsForMeal retrieves all steps for a given meal ID, ordered by step number
func GetStepsForMeal(db *sql.DB, mealID int) ([]Step, error) {
	rows, err := db.Query(`
		SELECT id, meal_id, step_number, instruction 
		FROM recipe_steps 
		WHERE meal_id = $1 
		ORDER BY step_number
	`, mealID)
	if err != nil {
		log.Printf("GetStepsForMeal: error executing query for mealID=%d: %v", mealID, err)
		return nil, err
	}
	defer rows.Close()

	var steps []Step
	for rows.Next() {
		var step Step
		if err := rows.Scan(&step.ID, &step.MealID, &step.StepNumber, &step.Instruction); err != nil {
			log.Printf("GetStepsForMeal: error scanning row for mealID=%d: %v", mealID, err)
			return nil, err
		}
		steps = append(steps, step)
	}

	if err := rows.Err(); err != nil {
		log.Printf("GetStepsForMeal: error in row iteration for mealID=%d: %v", mealID, err)
		return nil, err
	}

	return steps, nil
}

// AddStepToMeal adds a new step to a meal
func AddStepToMeal(db *sql.DB, step Step) (*Step, error) {
	// Check if meal exists
	var mealExists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM meals WHERE id = $1)", step.MealID).Scan(&mealExists)
	if err != nil {
		log.Printf("AddStepToMeal: error checking meal existence for mealID=%d: %v", step.MealID, err)
		return nil, err
	}
	if !mealExists {
		return nil, errors.New("meal does not exist")
	}

	// If no step number is provided, find the next available one
	if step.StepNumber <= 0 {
		err := db.QueryRow(`
			SELECT COALESCE(MAX(step_number), 0) + 1 
			FROM recipe_steps 
			WHERE meal_id = $1
		`, step.MealID).Scan(&step.StepNumber)
		if err != nil {
			log.Printf("AddStepToMeal: error determining next step number for mealID=%d: %v", step.MealID, err)
			return nil, err
		}
	}

	// Insert the new step
	err = db.QueryRow(`
		INSERT INTO recipe_steps (meal_id, step_number, instruction) 
		VALUES ($1, $2, $3) 
		RETURNING id
	`, step.MealID, step.StepNumber, step.Instruction).Scan(&step.ID)
	if err != nil {
		log.Printf("AddStepToMeal: error inserting step for mealID=%d: %v", step.MealID, err)
		return nil, err
	}

	return &step, nil
}

// AddMultipleStepsToMeal adds multiple steps to a meal in a single transaction
func AddMultipleStepsToMeal(db *sql.DB, mealID int, instructions []string) ([]Step, error) {
	if len(instructions) == 0 {
		return []Step{}, nil
	}

	// Check if meal exists
	var mealExists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM meals WHERE id = $1)", mealID).Scan(&mealExists)
	if err != nil {
		log.Printf("AddMultipleStepsToMeal: error checking meal existence for mealID=%d: %v", mealID, err)
		return nil, err
	}
	if !mealExists {
		return nil, errors.New("meal does not exist")
	}

	// Start a transaction
	tx, err := db.Begin()
	if err != nil {
		log.Printf("AddMultipleStepsToMeal: error starting transaction for mealID=%d: %v", mealID, err)
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
		log.Printf("AddMultipleStepsToMeal: error determining next step number for mealID=%d: %v", mealID, err)
		return nil, err
	}

	// Prepare statement for inserting steps
	stmt, err := tx.Prepare(`
		INSERT INTO recipe_steps (meal_id, step_number, instruction) 
		VALUES ($1, $2, $3) 
		RETURNING id
	`)
	if err != nil {
		log.Printf("AddMultipleStepsToMeal: error preparing statement for mealID=%d: %v", mealID, err)
		return nil, err
	}
	defer stmt.Close()

	// Insert each step
	steps := make([]Step, len(instructions))
	for i, instruction := range instructions {
		stepNumber := nextStepNumber + i
		step := Step{
			MealID:      mealID,
			StepNumber:  stepNumber,
			Instruction: instruction,
		}

		err = stmt.QueryRow(step.MealID, step.StepNumber, step.Instruction).Scan(&step.ID)
		if err != nil {
			log.Printf("AddMultipleStepsToMeal: error inserting step %d for mealID=%d: %v", i, mealID, err)
			return nil, err
		}

		steps[i] = step
	}

	// Commit the transaction
	if err = tx.Commit(); err != nil {
		log.Printf("AddMultipleStepsToMeal: error committing transaction for mealID=%d: %v", mealID, err)
		return nil, err
	}

	return steps, nil
}

// UpdateStep updates an existing recipe step
func UpdateStep(db *sql.DB, step Step) error {
	if step.ID == 0 {
		return errors.New("step ID not provided")
	}

	result, err := db.Exec(`
		UPDATE recipe_steps 
		SET step_number = $1, instruction = $2 
		WHERE id = $3 AND meal_id = $4
	`, step.StepNumber, step.Instruction, step.ID, step.MealID)
	if err != nil {
		log.Printf("UpdateStep: error executing update for stepID=%d, mealID=%d: %v", step.ID, step.MealID, err)
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		log.Printf("UpdateStep: error getting rows affected for stepID=%d: %v", step.ID, err)
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
		log.Printf("DeleteStep: error executing delete for stepID=%d, mealID=%d: %v", stepID, mealID, err)
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		log.Printf("DeleteStep: error getting rows affected for stepID=%d: %v", stepID, err)
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
		log.Printf("ReorderSteps: error starting transaction for mealID=%d: %v", mealID, err)
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
		log.Printf("ReorderSteps: error preparing first statement for mealID=%d: %v", mealID, err)
		return err
	}
	defer stmt1.Close()

	// First phase: set all step numbers to negative
	for _, stepID := range stepIDs {
		_, err := stmt1.Exec(stepID, mealID)
		if err != nil {
			log.Printf("ReorderSteps: error setting negative step number for stepID=%d, mealID=%d: %v", stepID, mealID, err)
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
		log.Printf("ReorderSteps: error preparing second statement for mealID=%d: %v", mealID, err)
		return err
	}
	defer stmt2.Close()

	// Second phase: update each step's number according to its position in the stepIDs slice
	for i, stepID := range stepIDs {
		stepNumber := i + 1 // steps are 1-indexed
		_, err := stmt2.Exec(stepNumber, stepID, mealID)
		if err != nil {
			log.Printf("ReorderSteps: error updating step number for stepID=%d, mealID=%d: %v", stepID, mealID, err)
			return err
		}
	}

	// Commit the transaction
	if err = tx.Commit(); err != nil {
		log.Printf("ReorderSteps: error committing transaction for mealID=%d: %v", mealID, err)
		return err
	}

	return nil
}

// DeleteAllStepsForMeal deletes all steps for a given meal
func DeleteAllStepsForMeal(db *sql.DB, mealID int) error {
	_, err := db.Exec("DELETE FROM recipe_steps WHERE meal_id = $1", mealID)
	if err != nil {
		log.Printf("DeleteAllStepsForMeal: error executing delete for mealID=%d: %v", mealID, err)
		return err
	}
	return nil
}
