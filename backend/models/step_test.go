package models

import (
	"database/sql"
	"testing"
)

func setupStepDB(t *testing.T) *sql.DB {
	// Create an in-memory SQLite database for testing
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("Error opening in-memory database: %v", err)
	}

	// Create tables
	_, err = db.Exec(`
		CREATE TABLE meals (
			id INTEGER PRIMARY KEY,
			meal_name TEXT NOT NULL,
			relative_effort INTEGER DEFAULT 3,
			last_planned TIMESTAMP,
			red_meat BOOLEAN DEFAULT FALSE,
			url TEXT
		)
	`)
	if err != nil {
		t.Fatalf("Error creating meals table: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE recipe_steps (
			id INTEGER PRIMARY KEY,
			meal_id INTEGER NOT NULL,
			step_number INTEGER NOT NULL,
			instruction TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE (meal_id, step_number),
			FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		t.Fatalf("Error creating recipe_steps table: %v", err)
	}

	// Insert a test meal
	_, err = db.Exec(`
		INSERT INTO meals (id, meal_name, relative_effort, red_meat)
		VALUES (1, 'Test Meal', 3, 0)
	`)
	if err != nil {
		t.Fatalf("Error inserting test meal: %v", err)
	}

	return db
}

func TestAddStepToMeal(t *testing.T) {
	db := setupStepDB(t)
	defer db.Close()

	// Test adding a step
	step := Step{
		MealID:      1,
		StepNumber:  1,
		Instruction: "Test instruction",
	}

	createdStep, err := AddStepToMeal(db, step)
	if err != nil {
		t.Fatalf("Error adding step: %v", err)
	}

	if createdStep.ID == 0 {
		t.Errorf("Expected non-zero ID for created step")
	}

	if createdStep.Instruction != "Test instruction" {
		t.Errorf("Expected instruction 'Test instruction', got '%s'", createdStep.Instruction)
	}

	// Test adding a step to non-existent meal
	invalidStep := Step{
		MealID:      999, // Non-existent meal ID
		StepNumber:  1,
		Instruction: "Invalid step",
	}

	_, err = AddStepToMeal(db, invalidStep)
	if err == nil {
		t.Errorf("Expected error when adding step to non-existent meal, got nil")
	}
}

func TestGetStepsForMeal(t *testing.T) {
	db := setupStepDB(t)
	defer db.Close()

	// Add multiple steps
	steps := []Step{
		{MealID: 1, StepNumber: 1, Instruction: "Step 1"},
		{MealID: 1, StepNumber: 2, Instruction: "Step 2"},
		{MealID: 1, StepNumber: 3, Instruction: "Step 3"},
	}

	for _, step := range steps {
		_, err := AddStepToMeal(db, step)
		if err != nil {
			t.Fatalf("Error adding test step: %v", err)
		}
	}

	// Test retrieving steps
	retrievedSteps, err := GetStepsForMeal(db, 1)
	if err != nil {
		t.Fatalf("Error getting steps: %v", err)
	}

	if len(retrievedSteps) != 3 {
		t.Errorf("Expected 3 steps, got %d", len(retrievedSteps))
	}

	// Check order
	if retrievedSteps[0].StepNumber != 1 || retrievedSteps[1].StepNumber != 2 || retrievedSteps[2].StepNumber != 3 {
		t.Errorf("Steps not in correct order")
	}

	// Test getting steps for non-existent meal
	emptySteps, err := GetStepsForMeal(db, 999)
	if err != nil {
		t.Fatalf("Unexpected error getting steps for non-existent meal: %v", err)
	}

	if len(emptySteps) != 0 {
		t.Errorf("Expected 0 steps for non-existent meal, got %d", len(emptySteps))
	}
}

func TestUpdateStep(t *testing.T) {
	db := setupStepDB(t)
	defer db.Close()

	// Add a step
	step := Step{
		MealID:      1,
		StepNumber:  1,
		Instruction: "Original instruction",
	}

	createdStep, err := AddStepToMeal(db, step)
	if err != nil {
		t.Fatalf("Error adding test step: %v", err)
	}

	// Update the step
	createdStep.Instruction = "Updated instruction"
	err = UpdateStep(db, *createdStep)
	if err != nil {
		t.Fatalf("Error updating step: %v", err)
	}

	// Verify update
	steps, err := GetStepsForMeal(db, 1)
	if err != nil {
		t.Fatalf("Error getting steps after update: %v", err)
	}

	if len(steps) != 1 {
		t.Fatalf("Expected 1 step, got %d", len(steps))
	}

	if steps[0].Instruction != "Updated instruction" {
		t.Errorf("Expected instruction 'Updated instruction', got '%s'", steps[0].Instruction)
	}
}

func TestDeleteStep(t *testing.T) {
	db := setupStepDB(t)
	defer db.Close()

	// Add steps
	step1 := Step{MealID: 1, StepNumber: 1, Instruction: "Step 1"}
	step2 := Step{MealID: 1, StepNumber: 2, Instruction: "Step 2"}

	createdStep1, err := AddStepToMeal(db, step1)
	if err != nil {
		t.Fatalf("Error adding test step 1: %v", err)
	}

	_, err = AddStepToMeal(db, step2)
	if err != nil {
		t.Fatalf("Error adding test step 2: %v", err)
	}

	// Delete the first step
	err = DeleteStep(db, createdStep1.ID, 1)
	if err != nil {
		t.Fatalf("Error deleting step: %v", err)
	}

	// Verify deletion
	steps, err := GetStepsForMeal(db, 1)
	if err != nil {
		t.Fatalf("Error getting steps after deletion: %v", err)
	}

	if len(steps) != 1 {
		t.Errorf("Expected 1 step after deletion, got %d", len(steps))
	}

	// Test deleting non-existent step
	err = DeleteStep(db, 999, 1)
	if err == nil {
		t.Errorf("Expected error when deleting non-existent step, got nil")
	}
}

func TestAddMultipleStepsToMeal(t *testing.T) {
	db := setupStepDB(t)
	defer db.Close()

	// Test adding multiple steps
	instructions := []string{
		"Step 1 instruction",
		"Step 2 instruction",
		"Step 3 instruction",
	}

	steps, err := AddMultipleStepsToMeal(db, 1, instructions)
	if err != nil {
		t.Fatalf("Error adding multiple steps: %v", err)
	}

	if len(steps) != 3 {
		t.Errorf("Expected 3 steps created, got %d", len(steps))
	}

	// Verify step numbers are sequential
	for i, step := range steps {
		if step.StepNumber != i+1 {
			t.Errorf("Expected step number %d, got %d", i+1, step.StepNumber)
		}
	}

	// Test with empty instructions array
	emptySteps, err := AddMultipleStepsToMeal(db, 1, []string{})
	if err != nil {
		t.Fatalf("Unexpected error with empty instructions: %v", err)
	}

	if len(emptySteps) != 0 {
		t.Errorf("Expected 0 steps with empty instructions, got %d", len(emptySteps))
	}

	// Test adding steps to non-existent meal
	_, err = AddMultipleStepsToMeal(db, 999, instructions)
	if err == nil {
		t.Errorf("Expected error when adding steps to non-existent meal, got nil")
	}
}

func TestReorderSteps(t *testing.T) {
	db := setupStepDB(t)
	defer db.Close()

	// Add multiple steps
	step1 := Step{MealID: 1, StepNumber: 1, Instruction: "Step 1"}
	step2 := Step{MealID: 1, StepNumber: 2, Instruction: "Step 2"}
	step3 := Step{MealID: 1, StepNumber: 3, Instruction: "Step 3"}

	created1, err := AddStepToMeal(db, step1)
	if err != nil {
		t.Fatalf("Error adding test step 1: %v", err)
	}

	created2, err := AddStepToMeal(db, step2)
	if err != nil {
		t.Fatalf("Error adding test step 2: %v", err)
	}

	created3, err := AddStepToMeal(db, step3)
	if err != nil {
		t.Fatalf("Error adding test step 3: %v", err)
	}

	// Reorder steps (3, 1, 2)
	newOrder := []int{created3.ID, created1.ID, created2.ID}
	err = ReorderSteps(db, 1, newOrder)
	if err != nil {
		t.Fatalf("Error reordering steps: %v", err)
	}

	// Verify new order
	steps, err := GetStepsForMeal(db, 1)
	if err != nil {
		t.Fatalf("Error getting steps after reordering: %v", err)
	}

	if len(steps) != 3 {
		t.Fatalf("Expected 3 steps, got %d", len(steps))
	}

	expectedInstructions := []string{"Step 3", "Step 1", "Step 2"}
	for i, step := range steps {
		if step.Instruction != expectedInstructions[i] {
			t.Errorf("Step %d: expected instruction '%s', got '%s'",
				i+1, expectedInstructions[i], step.Instruction)
		}
		if step.StepNumber != i+1 {
			t.Errorf("Step %d: expected step number %d, got %d",
				i+1, i+1, step.StepNumber)
		}
	}
}

func TestDeleteAllStepsForMeal(t *testing.T) {
	db := setupStepDB(t)
	defer db.Close()

	// Add multiple steps
	instructions := []string{
		"Step 1 instruction",
		"Step 2 instruction",
		"Step 3 instruction",
	}

	_, err := AddMultipleStepsToMeal(db, 1, instructions)
	if err != nil {
		t.Fatalf("Error adding multiple steps: %v", err)
	}

	// Delete all steps
	err = DeleteAllStepsForMeal(db, 1)
	if err != nil {
		t.Fatalf("Error deleting all steps: %v", err)
	}

	// Verify deletion
	steps, err := GetStepsForMeal(db, 1)
	if err != nil {
		t.Fatalf("Error getting steps after deletion: %v", err)
	}

	if len(steps) != 0 {
		t.Errorf("Expected 0 steps after deletion, got %d", len(steps))
	}

	// Test deleting steps for non-existent meal (should not error)
	err = DeleteAllStepsForMeal(db, 999)
	if err != nil {
		t.Errorf("Unexpected error when deleting steps for non-existent meal: %v", err)
	}
}
