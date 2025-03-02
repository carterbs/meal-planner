package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"mealplanner/models"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	_ "github.com/mattn/go-sqlite3" // Import SQLite driver
)

func setupStepHandlerTest(t *testing.T) *sql.DB {
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

	// Set the package-level DB variable
	DB = db

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

func TestGetStepsHandler(t *testing.T) {
	db := setupStepHandlerTest(t)
	defer db.Close()

	// Add some steps
	_, err := db.Exec(`
		INSERT INTO recipe_steps (meal_id, step_number, instruction)
		VALUES (1, 1, 'Step 1'), (1, 2, 'Step 2')
	`)
	if err != nil {
		t.Fatalf("Error inserting test steps: %v", err)
	}

	// Create a request
	req, err := http.NewRequest("GET", "/api/meals/1/steps", nil)
	if err != nil {
		t.Fatalf("Error creating request: %v", err)
	}

	// Create a router with the handler
	r := chi.NewRouter()
	r.Get("/api/meals/{mealId}/steps", GetStepsHandler)

	// Create a response recorder
	rr := httptest.NewRecorder()

	// Serve the request
	r.ServeHTTP(rr, req)

	// Check the status code
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Check the response body
	var steps []models.Step
	if err := json.Unmarshal(rr.Body.Bytes(), &steps); err != nil {
		t.Fatalf("Error unmarshaling response: %v", err)
	}

	if len(steps) != 2 {
		t.Errorf("Expected 2 steps, got %d", len(steps))
	}

	// Test with invalid meal ID
	req, _ = http.NewRequest("GET", "/api/meals/invalid/steps", nil)
	rr = httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("Handler returned wrong status code for invalid ID: got %v want %v", status, http.StatusBadRequest)
	}
}

func TestAddStepHandler(t *testing.T) {
	db := setupStepHandlerTest(t)
	defer db.Close()

	// Create a step to add
	step := models.Step{
		Instruction: "Test step instruction",
	}

	stepJSON, err := json.Marshal(step)
	if err != nil {
		t.Fatalf("Error marshaling step: %v", err)
	}

	// Create a request
	req, err := http.NewRequest("POST", "/api/meals/1/steps", bytes.NewBuffer(stepJSON))
	if err != nil {
		t.Fatalf("Error creating request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// Create a router with the handler
	r := chi.NewRouter()
	r.Post("/api/meals/{mealId}/steps", AddStepHandler)

	// Create a response recorder
	rr := httptest.NewRecorder()

	// Serve the request
	r.ServeHTTP(rr, req)

	// Check the status code
	if status := rr.Code; status != http.StatusCreated {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusCreated)
	}

	// Check the response body
	var createdStep models.Step
	if err := json.Unmarshal(rr.Body.Bytes(), &createdStep); err != nil {
		t.Fatalf("Error unmarshaling response: %v", err)
	}

	if createdStep.ID == 0 {
		t.Errorf("Expected non-zero ID for created step")
	}

	if createdStep.Instruction != "Test step instruction" {
		t.Errorf("Expected instruction 'Test step instruction', got '%s'", createdStep.Instruction)
	}

	// Test with invalid meal ID
	req, _ = http.NewRequest("POST", "/api/meals/invalid/steps", bytes.NewBuffer(stepJSON))
	req.Header.Set("Content-Type", "application/json")
	rr = httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("Handler returned wrong status code for invalid ID: got %v want %v", status, http.StatusBadRequest)
	}
}

func TestAddBulkStepsHandler(t *testing.T) {
	db := setupStepHandlerTest(t)
	defer db.Close()

	// Test cases for different formats
	testCases := []struct {
		name        string
		contentType string
		input       string
		expected    int // expected number of steps created
	}{
		{
			name:        "Numbered list",
			contentType: "text/plain",
			input:       "1. First step\n2. Second step\n3. Third step",
			expected:    3,
		},
		{
			name:        "Bulleted list",
			contentType: "text/plain",
			input:       "- First step\n- Second step\n- Third step",
			expected:    3,
		},
		{
			name:        "Paragraphs",
			contentType: "text/plain",
			input:       "First step\n\nSecond step\n\nThird step",
			expected:    3,
		},
		{
			name:        "Single lines",
			contentType: "text/plain",
			input:       "First step\nSecond step\nThird step",
			expected:    3,
		},
		{
			name:        "JSON with text",
			contentType: "application/json",
			input:       `{"text":"1. First step\n2. Second step\n3. Third step"}`,
			expected:    3,
		},
		{
			name:        "JSON with instructions array",
			contentType: "application/json",
			input:       `{"instructions":["First step","Second step","Third step"]}`,
			expected:    3,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Reset steps table for each test
			_, err := db.Exec("DELETE FROM recipe_steps WHERE meal_id = 1")
			if err != nil {
				t.Fatalf("Error clearing steps: %v", err)
			}

			// Create a request
			req, err := http.NewRequest("POST", "/api/meals/1/steps/bulk", strings.NewReader(tc.input))
			if err != nil {
				t.Fatalf("Error creating request: %v", err)
			}
			req.Header.Set("Content-Type", tc.contentType)

			// Create a router with the handler
			r := chi.NewRouter()
			r.Post("/api/meals/{mealId}/steps/bulk", AddBulkStepsHandler)

			// Create a response recorder
			rr := httptest.NewRecorder()

			// Serve the request
			r.ServeHTTP(rr, req)

			// Check the status code
			if status := rr.Code; status != http.StatusCreated {
				t.Errorf("Handler returned wrong status code: got %v want %v, body: %s",
					status, http.StatusCreated, rr.Body.String())
			}

			// Check the response body
			var steps []models.Step
			if err := json.Unmarshal(rr.Body.Bytes(), &steps); err != nil {
				t.Fatalf("Error unmarshaling response: %v", err)
			}

			if len(steps) != tc.expected {
				t.Errorf("Expected %d steps, got %d", tc.expected, len(steps))
			}

			// Verify step numbers are sequential
			for i, step := range steps {
				if step.StepNumber != i+1 {
					t.Errorf("Expected step number %d, got %d", i+1, step.StepNumber)
				}
			}
		})
	}

	// Test with invalid meal ID
	req, _ := http.NewRequest("POST", "/api/meals/invalid/steps/bulk", strings.NewReader("Test step"))
	req.Header.Set("Content-Type", "text/plain")
	rr := httptest.NewRecorder()
	r := chi.NewRouter()
	r.Post("/api/meals/{mealId}/steps/bulk", AddBulkStepsHandler)
	r.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("Handler returned wrong status code for invalid ID: got %v want %v", status, http.StatusBadRequest)
	}
}

func TestUpdateStepHandler(t *testing.T) {
	db := setupStepHandlerTest(t)
	defer db.Close()

	// Add a step
	var stepID int
	err := db.QueryRow(`
		INSERT INTO recipe_steps (meal_id, step_number, instruction)
		VALUES (1, 1, 'Original instruction')
		RETURNING id
	`).Scan(&stepID)
	if err != nil {
		t.Fatalf("Error inserting test step: %v", err)
	}

	// Create updated step
	updatedStep := models.Step{
		Instruction: "Updated instruction",
		StepNumber:  1,
	}

	stepJSON, err := json.Marshal(updatedStep)
	if err != nil {
		t.Fatalf("Error marshaling step: %v", err)
	}

	// Create a request
	req, err := http.NewRequest("PUT", "/api/meals/1/steps/"+strconv.Itoa(stepID), bytes.NewBuffer(stepJSON))
	if err != nil {
		t.Fatalf("Error creating request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// Create a router with the handler
	r := chi.NewRouter()
	r.Put("/api/meals/{mealId}/steps/{stepId}", UpdateStepHandler)

	// Create a response recorder
	rr := httptest.NewRecorder()

	// Serve the request
	r.ServeHTTP(rr, req)

	// Check the status code
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Verify step was updated
	var instruction string
	err = db.QueryRow("SELECT instruction FROM recipe_steps WHERE id = ?", stepID).Scan(&instruction)
	if err != nil {
		t.Fatalf("Error querying updated step: %v", err)
	}

	if instruction != "Updated instruction" {
		t.Errorf("Expected instruction 'Updated instruction', got '%s'", instruction)
	}
}

func TestDeleteStepHandler(t *testing.T) {
	db := setupStepHandlerTest(t)
	defer db.Close()

	// Add a step
	var stepID int
	err := db.QueryRow(`
		INSERT INTO recipe_steps (meal_id, step_number, instruction)
		VALUES (1, 1, 'Step to delete')
		RETURNING id
	`).Scan(&stepID)
	if err != nil {
		t.Fatalf("Error inserting test step: %v", err)
	}

	// Create a request
	req, err := http.NewRequest("DELETE", "/api/meals/1/steps/"+strconv.Itoa(stepID), nil)
	if err != nil {
		t.Fatalf("Error creating request: %v", err)
	}

	// Create a router with the handler
	r := chi.NewRouter()
	r.Delete("/api/meals/{mealId}/steps/{stepId}", DeleteStepHandler)

	// Create a response recorder
	rr := httptest.NewRecorder()

	// Serve the request
	r.ServeHTTP(rr, req)

	// Check the status code
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Verify step was deleted
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM recipe_steps WHERE id = ?", stepID).Scan(&count)
	if err != nil {
		t.Fatalf("Error querying step count: %v", err)
	}

	if count != 0 {
		t.Errorf("Expected step to be deleted, but it still exists")
	}
}

func TestReorderStepsHandler(t *testing.T) {
	db := setupStepHandlerTest(t)
	defer db.Close()

	// Add multiple steps
	stepIDs := make([]int, 3)
	for i := 0; i < 3; i++ {
		err := db.QueryRow(`
			INSERT INTO recipe_steps (meal_id, step_number, instruction)
			VALUES (1, ?, ?)
			RETURNING id
		`, i+1, "Step "+strconv.Itoa(i+1)).Scan(&stepIDs[i])
		if err != nil {
			t.Fatalf("Error inserting test step %d: %v", i+1, err)
		}
	}

	// Create a request to reorder steps (3, 1, 2)
	payload := struct {
		StepIDs []int `json:"stepIds"`
	}{
		StepIDs: []int{stepIDs[2], stepIDs[0], stepIDs[1]},
	}

	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("Error marshaling payload: %v", err)
	}

	req, err := http.NewRequest("PUT", "/api/meals/1/steps/reorder", bytes.NewBuffer(payloadJSON))
	if err != nil {
		t.Fatalf("Error creating request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// Create a router with the handler
	r := chi.NewRouter()
	r.Put("/api/meals/{mealId}/steps/reorder", ReorderStepsHandler)

	// Create a response recorder
	rr := httptest.NewRecorder()

	// Serve the request
	r.ServeHTTP(rr, req)

	// Check the status code
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Verify the new order
	rows, err := db.Query("SELECT id, step_number FROM recipe_steps WHERE meal_id = 1 ORDER BY step_number")
	if err != nil {
		t.Fatalf("Error querying steps: %v", err)
	}
	defer rows.Close()

	expectedOrder := []int{stepIDs[2], stepIDs[0], stepIDs[1]}
	i := 0
	for rows.Next() {
		var id, stepNumber int
		if err := rows.Scan(&id, &stepNumber); err != nil {
			t.Fatalf("Error scanning row: %v", err)
		}

		if id != expectedOrder[i] {
			t.Errorf("Expected step ID %d at position %d, got %d", expectedOrder[i], i+1, id)
		}

		if stepNumber != i+1 {
			t.Errorf("Expected step number %d, got %d", i+1, stepNumber)
		}

		i++
	}

	if i != 3 {
		t.Errorf("Expected 3 steps, got %d", i)
	}
}

func TestDeleteAllStepsHandler(t *testing.T) {
	db := setupStepHandlerTest(t)
	defer db.Close()

	// Add multiple steps
	for i := 0; i < 3; i++ {
		_, err := db.Exec(`
			INSERT INTO recipe_steps (meal_id, step_number, instruction)
			VALUES (1, ?, ?)
		`, i+1, "Step "+strconv.Itoa(i+1))
		if err != nil {
			t.Fatalf("Error inserting test step %d: %v", i+1, err)
		}
	}

	// Create a request
	req, err := http.NewRequest("DELETE", "/api/meals/1/steps", nil)
	if err != nil {
		t.Fatalf("Error creating request: %v", err)
	}

	// Create a router with the handler
	r := chi.NewRouter()
	r.Delete("/api/meals/{mealId}/steps", DeleteAllStepsHandler)

	// Create a response recorder
	rr := httptest.NewRecorder()

	// Serve the request
	r.ServeHTTP(rr, req)

	// Check the status code
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Verify all steps were deleted
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM recipe_steps WHERE meal_id = 1").Scan(&count)
	if err != nil {
		t.Fatalf("Error querying step count: %v", err)
	}

	if count != 0 {
		t.Errorf("Expected all steps to be deleted, but %d still exist", count)
	}
}
