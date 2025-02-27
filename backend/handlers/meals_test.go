package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"
	"time"

	"github.com/lib/pq"

	"mealplanner/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/go-chi/chi/v5"
)

// testHelper contains utilities for testing handlers
type testHelper struct {
	db   *sql.DB
	mock sqlmock.Sqlmock
}

// setupTest creates a new test helper with mock DB
func setupTest(t *testing.T) *testHelper {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	
	// Store the original DB
	originalDB := DB
	DB = db
	
	// Restore the original DB after the test
	t.Cleanup(func() {
		db.Close()
		DB = originalDB
	})
	
	return &testHelper{db, mock}
}

// setupMealRows creates mock rows for meal queries
func setupMealRows(fields []string) *sqlmock.Rows {
	return sqlmock.NewRows(fields)
}

// expectMealQuery sets up expectations for a meal query
func (h *testHelper) expectMealQuery(queryRegex string, args ...interface{}) *sqlmock.Rows {
	rows := sqlmock.NewRows([]string{
		"id", "meal_name", "relative_effort", "last_planned", "red_meat",
		"ingredient_id", "name", "quantity", "unit",
	})
	
	expectation := h.mock.ExpectQuery(regexp.QuoteMeta(queryRegex))
	if len(args) > 0 {
		expectation.WithArgs(args[0]) // Handle single argument case
	}
	expectation.WillReturnRows(rows)
	
	return rows
}

// expectTransaction sets up expectations for a transaction
func (h *testHelper) expectTransaction(success bool) {
	h.mock.ExpectBegin()
	if !success {
		h.mock.ExpectRollback()
	} else {
		h.mock.ExpectCommit()
	}
}

// createRequest creates an HTTP request with optional body
func createRequest(method, path string, body interface{}) (*http.Request, error) {
	var bodyBuffer *bytes.Buffer
	
	if body != nil {
		bodyBytes, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyBuffer = bytes.NewBuffer(bodyBytes)
	} else {
		bodyBuffer = bytes.NewBuffer(nil)
	}
	
	req, err := http.NewRequest(method, path, bodyBuffer)
	if err != nil {
		return nil, err
	}
	
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	
	return req, nil
}

// addURLParams adds Chi URL parameters to a request
func addURLParams(req *http.Request, params map[string]string) *http.Request {
	rctx := chi.NewRouteContext()
	for key, value := range params {
		rctx.URLParams.Add(key, value)
	}
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

func TestGetAllMealsHandler(t *testing.T) {
	// Setup test helper
	helper := setupTest(t)
	
	// Setup test data
	now := time.Now()
	
	// Setup rows for meals in the response
	rows := helper.expectMealQuery(models.GetAllMealsQuery)
	
	// Add meal data to rows
	rows.AddRow(1, "Meal A", 2, now, false, 1, "Eggs", 0, "dozen")
	rows.AddRow(2, "Meal B", 3, now, true, 2, "Milk", 2.5, "gallon")
	rows.AddRow(2, "Meal B", 3, now, true, 3, "Bread", 0, "loaf")
	
	// Create request and response recorder
	req, err := createRequest("GET", "/api/meals", nil)
	if err != nil {
		t.Fatalf("could not create request: %v", err)
	}
	
	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(GetAllMealsHandler)
	handler.ServeHTTP(rr, req)
	
	// Check response status
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}
	
	// Decode and verify response
	var meals []*models.Meal
	if err := json.NewDecoder(rr.Body).Decode(&meals); err != nil {
		t.Fatalf("could not decode response: %v", err)
	}
	
	if len(meals) != 2 {
		t.Errorf("expected 2 meals, got %d", len(meals))
	}
	
	// Verify all expectations were met
	if err := helper.mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %s", err)
	}
}

// TestUpdateMealIngredientHandler verifies that sending a PUT request to update an ingredient
// results in a proper update via the DB transaction and returns the updated meal.
func TestUpdateMealIngredientHandler(t *testing.T) {
	// Setup test helper
	helper := setupTest(t)
	
	mealID := 1
	updatedIngredient := models.Ingredient{
		ID:       1,
		Name:     "Sugar",
		Quantity: 2.0,
		Unit:     "cup",
	}

	// Expect a single UPDATE query using SQL from the model file
	helper.mock.ExpectExec(regexp.QuoteMeta("UPDATE ingredients SET name=$1, quantity=$2, unit=$3 WHERE id=$4 AND meal_id=$5")).
		WithArgs(updatedIngredient.Name, updatedIngredient.Quantity, updatedIngredient.Unit, updatedIngredient.ID, mealID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Expect query to return updated meal
	now := time.Now()
	rows := helper.expectMealQuery(models.GetMealsByIDsQuery, pq.Array([]int{mealID}))
	rows.AddRow(mealID, "Test Meal", 1, now, false, 1, updatedIngredient.Name, updatedIngredient.Quantity, updatedIngredient.Unit)

	// Create a PUT request to update the ingredient
	req, err := createRequest("PUT", "/api/meals/1/ingredients/1", updatedIngredient)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	
	// Add URL parameters
	req = addURLParams(req, map[string]string{
		"mealId":       "1",
		"ingredientId": "1",
	})

	// Execute the request
	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(UpdateMealIngredientHandler)
	handler.ServeHTTP(rr, req)

	// Check response status
	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	// Decode and verify response
	var meal models.Meal
	if err := json.NewDecoder(rr.Body).Decode(&meal); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(meal.Ingredients) != 1 {
		t.Errorf("expected 1 ingredient, got %d", len(meal.Ingredients))
	}
	if meal.Ingredients[0].Quantity != updatedIngredient.Quantity {
		t.Errorf("expected quantity %v, got %v", updatedIngredient.Quantity, meal.Ingredients[0].Quantity)
	}
	
	// Verify all expectations were met
	if err := helper.mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %s", err)
	}
}

// TestDeleteMealIngredientHandler verifies that sending a DELETE request for an ingredient
// properly deletes it and returns the updated meal.
func TestDeleteMealIngredientHandler(t *testing.T) {
	// Setup test helper
	helper := setupTest(t)
	
	mealID := 1
	ingredientID := 1

	// Expect deletion query
	helper.mock.ExpectExec(regexp.QuoteMeta("DELETE FROM ingredients WHERE id = $1")).
		WithArgs(ingredientID).
		WillReturnResult(sqlmock.NewResult(1, 1))

	// Expect query to return updated meal
	now := time.Now()
	rows := helper.expectMealQuery(models.GetMealsByIDsQuery, pq.Array([]int{mealID}))
	rows.AddRow(mealID, "Test Meal", 1, now, false, 2, "Pepper", 0.5, "tsp")

	// Create request and add URL parameters
	req, err := createRequest("DELETE", "/api/meals/1/ingredients/1", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	
	req = addURLParams(req, map[string]string{
		"mealId":       "1",
		"ingredientId": "1",
	})

	// Execute request
	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(DeleteMealIngredientHandler)
	handler.ServeHTTP(rr, req)

	// Check response status
	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	// Decode and verify response
	var meal models.Meal
	if err := json.NewDecoder(rr.Body).Decode(&meal); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	// Verify meal data
	if len(meal.Ingredients) != 1 {
		t.Errorf("expected 1 ingredient remaining, got %d", len(meal.Ingredients))
	}
	if meal.Ingredients[0].Name != "Pepper" {
		t.Errorf("expected remaining ingredient to be 'Pepper', got %s", meal.Ingredients[0].Name)
	}
	
	// Verify all expectations were met
	if err := helper.mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %s", err)
	}
}

func TestDeleteMealHandler(t *testing.T) {
	// Create a direct connection to avoid cleanup timing issues
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()
	
	// Store the original DB and restore after test
	originalDB := DB
	DB = db
	defer func() { DB = originalDB }()
	
	mealID := 1

	// Expect transaction
	mock.ExpectBegin()

	// Expect deletion of ingredients
	mock.ExpectExec("DELETE FROM ingredients WHERE meal_id = \\$1").
		WithArgs(mealID).
		WillReturnResult(sqlmock.NewResult(0, 2)) // 2 ingredients deleted

	// Expect deletion of meal
	mock.ExpectExec("DELETE FROM meals WHERE id = \\$1").
		WithArgs(mealID).
		WillReturnResult(sqlmock.NewResult(0, 1)) // 1 meal deleted

	// Expect commit
	mock.ExpectCommit()

	// Create request
	req, err := createRequest("DELETE", "/api/meals/1", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	// Add URL parameters
	req = addURLParams(req, map[string]string{
		"mealId": "1",
	})

	// Execute request
	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(DeleteMealHandler)
	handler.ServeHTTP(rr, req)

	// Check response status
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Verify all expectations were met
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("there were unfulfilled expectations: %s", err)
	}
}

// Add test for error cases
func TestDeleteMealHandlerErrors(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to open sqlmock: %v", err)
	}
	defer db.Close()

	DB = db

	tests := []struct {
		name          string
		mealID        string
		setupMock     func()
		expectedCode  int
		expectedError string
	}{
		{
			name:          "invalid meal ID",
			mealID:        "invalid",
			setupMock:     func() {},
			expectedCode:  http.StatusBadRequest,
			expectedError: "Invalid meal ID\n",
		},
		{
			name:   "meal not found",
			mealID: "1",
			setupMock: func() {
				mock.ExpectBegin()
				mock.ExpectExec(regexp.QuoteMeta("DELETE FROM ingredients WHERE meal_id = $1")).
					WithArgs(1).
					WillReturnResult(sqlmock.NewResult(0, 0))
				mock.ExpectExec(regexp.QuoteMeta("DELETE FROM meals WHERE id = $1")).
					WithArgs(1).
					WillReturnResult(sqlmock.NewResult(0, 0))
				mock.ExpectRollback()
			},
			expectedCode:  http.StatusInternalServerError,
			expectedError: "meal not found\n",
		},
		{
			name:   "database error",
			mealID: "1",
			setupMock: func() {
				mock.ExpectBegin()
				mock.ExpectExec(regexp.QuoteMeta("DELETE FROM ingredients WHERE meal_id = $1")).
					WithArgs(1).
					WillReturnError(errors.New("database error"))
				mock.ExpectRollback()
			},
			expectedCode:  http.StatusInternalServerError,
			expectedError: "database error\n",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setupMock()

			req, err := http.NewRequest("DELETE", "/api/meals/"+tt.mealID, nil)
			if err != nil {
				t.Fatalf("failed to create request: %v", err)
			}

			rctx := chi.NewRouteContext()
			rctx.URLParams.Add("mealId", tt.mealID)
			req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

			rr := httptest.NewRecorder()
			handler := http.HandlerFunc(DeleteMealHandler)
			handler.ServeHTTP(rr, req)

			if status := rr.Code; status != tt.expectedCode {
				t.Errorf("handler returned wrong status code: got %v want %v", status, tt.expectedCode)
			}

			if rr.Body.String() != tt.expectedError {
				t.Errorf("handler returned unexpected error: got %v want %v", rr.Body.String(), tt.expectedError)
			}
		})
	}
}

func TestFinalizeMealPlanHandler(t *testing.T) {
	tests := []struct {
		name         string
		payload      string
		setupMock    func(mock sqlmock.Sqlmock)
		expectedCode int
		expectedBody string
	}{
		{
			name:    "successful finalization",
			payload: `{"plan": {"Monday": {"id": 1}, "Tuesday": {"id": 2}}}`,
			setupMock: func(mock sqlmock.Sqlmock) {
				mock.ExpectBegin()
				mock.ExpectExec(regexp.QuoteMeta(`
					UPDATE meals 
					SET last_planned = NOW() 
					WHERE id = ANY($1)
				`)).WithArgs(pq.Array([]int{1, 2})).
					WillReturnResult(sqlmock.NewResult(0, 2))
				mock.ExpectCommit()
			},
			expectedCode: http.StatusOK,
			expectedBody: "Plan finalized",
		},
		{
			name:         "invalid json payload",
			payload:      `{invalid json}`,
			setupMock:    func(mock sqlmock.Sqlmock) {},
			expectedCode: http.StatusBadRequest,
			expectedBody: "Invalid request payload\n",
		},
		{
			name:    "database error",
			payload: `{"plan": {"Monday": {"id": 1}}}`,
			setupMock: func(mock sqlmock.Sqlmock) {
				mock.ExpectBegin()
				mock.ExpectExec(regexp.QuoteMeta(`
					UPDATE meals 
					SET last_planned = NOW() 
					WHERE id = ANY($1)
				`)).WithArgs(pq.Array([]int{1})).
					WillReturnError(errors.New("database error"))
				mock.ExpectRollback()
			},
			expectedCode: http.StatusInternalServerError,
			expectedBody: "database error\n",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a new mock for each test case
			db, mock, err := sqlmock.New()
			if err != nil {
				t.Fatalf("failed to create sqlmock: %v", err)
			}
			defer db.Close()

			// Set the DB for handlers
			DB = db

			// Setup mock expectations
			tt.setupMock(mock)

			req, err := http.NewRequest("POST", "/api/mealplan/finalize",
				bytes.NewBufferString(tt.payload))
			if err != nil {
				t.Fatalf("failed to create request: %v", err)
			}

			// Set content type header
			req.Header.Set("Content-Type", "application/json")

			rr := httptest.NewRecorder()
			handler := http.HandlerFunc(FinalizeMealPlanHandler)
			handler.ServeHTTP(rr, req)

			if status := rr.Code; status != tt.expectedCode {
				t.Errorf("handler returned wrong status code: got %v want %v",
					status, tt.expectedCode)
			}

			if rr.Body.String() != tt.expectedBody {
				t.Errorf("handler returned unexpected body: got %v want %v",
					rr.Body.String(), tt.expectedBody)
			}

			if err := mock.ExpectationsWereMet(); err != nil {
				t.Errorf("there were unfulfilled expectations: %s", err)
			}
		})
	}
}

func TestGetAllMealsHandler_AlphabeticalOrder(t *testing.T) {
	// Create a new sqlmock database connection
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	// Store the original DB and restore it after the test
	originalDB := DB
	DB = db
	defer func() { DB = originalDB }()

	// Setup rows with meals in non-alphabetical order
	rows := sqlmock.NewRows([]string{
		"id", "meal_name", "relative_effort", "last_planned", "red_meat",
		"ingredient_id", "name", "quantity", "unit",
	}).
		AddRow(1, "Zucchini Pasta", 2, nil, false, nil, nil, nil, nil).
		AddRow(2, "apple pie", 3, nil, false, nil, nil, nil, nil).
		AddRow(3, "Meatballs", 4, nil, true, nil, nil, nil, nil).
		AddRow(4, "banana bread", 2, nil, false, nil, nil, nil, nil)

	// Expect the query
	mock.ExpectQuery(regexp.QuoteMeta(models.GetAllMealsQuery)).
		WillReturnRows(rows)

	// Create a request to pass to our handler
	req, err := http.NewRequest("GET", "/api/meals", nil)
	if err != nil {
		t.Fatal(err)
	}

	// Create a ResponseRecorder to record the response
	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(GetAllMealsHandler)

	// Call the handler
	handler.ServeHTTP(rr, req)

	// Check the status code
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Parse the response body
	var response []*models.Meal
	if err := json.NewDecoder(rr.Body).Decode(&response); err != nil {
		t.Fatalf("couldn't parse response: %v", err)
	}

	// Verify meals are sorted alphabetically (case-insensitive)
	expectedOrder := []string{"apple pie", "banana bread", "Meatballs", "Zucchini Pasta"}
	if len(response) != len(expectedOrder) {
		t.Fatalf("expected %d meals, got %d", len(expectedOrder), len(response))
	}

	for i, expectedName := range expectedOrder {
		if response[i].MealName != expectedName {
			t.Errorf("meal at position %d: expected %q, got %q", i, expectedName, response[i].MealName)
		}
	}

	// Verify all expectations were met
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %s", err)
	}
}

// TestCreateMealHandler tests the creation of a new meal with ingredients
func TestCreateMealHandler(t *testing.T) {
	// Create a new sqlmock database connection
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	// Store the original DB and restore it after the test
	originalDB := DB
	DB = db
	defer func() { DB = originalDB }()

	// Create a test meal with ingredients
	newMeal := models.Meal{
		MealName:       "Test Recipe",
		RelativeEffort: 2,
		RedMeat:        false,
		Ingredients: []models.Ingredient{
			{Name: "Ingredient 1", Quantity: 1, Unit: "cup"},
			{Name: "Ingredient 2", Quantity: 2, Unit: "tbsp"},
		},
	}

	// Expected meal ID after creation
	const expectedMealID = 10
	
	// Expected ingredient IDs after creation
	expectedIngIDs := []int{100, 101}

	// Setup mock expectations
	// 1. Begin transaction
	mock.ExpectBegin()
	
	// 2. Insert meal
	mock.ExpectQuery(regexp.QuoteMeta("INSERT INTO meals (meal_name, relative_effort, red_meat) VALUES ($1, $2, $3) RETURNING id")).
		WithArgs(newMeal.MealName, newMeal.RelativeEffort, newMeal.RedMeat).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(expectedMealID))
	
	// 3. Insert first ingredient
	mock.ExpectQuery(regexp.QuoteMeta("INSERT INTO ingredients (meal_id, quantity, unit, name) VALUES ($1, $2, $3, $4) RETURNING id")).
		WithArgs(expectedMealID, newMeal.Ingredients[0].Quantity, newMeal.Ingredients[0].Unit, newMeal.Ingredients[0].Name).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(expectedIngIDs[0]))
	
	// 4. Insert second ingredient
	mock.ExpectQuery(regexp.QuoteMeta("INSERT INTO ingredients (meal_id, quantity, unit, name) VALUES ($1, $2, $3, $4) RETURNING id")).
		WithArgs(expectedMealID, newMeal.Ingredients[1].Quantity, newMeal.Ingredients[1].Unit, newMeal.Ingredients[1].Name).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(expectedIngIDs[1]))
	
	// 5. Commit transaction
	mock.ExpectCommit()

	// Create request with meal data
	body, err := json.Marshal(newMeal)
	if err != nil {
		t.Fatalf("failed to marshal meal: %v", err)
	}

	req, err := http.NewRequest("POST", "/api/meals", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// Create response recorder and call handler
	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(CreateMealHandler)
	handler.ServeHTTP(rr, req)

	// Check status code is 201 Created
	if status := rr.Code; status != http.StatusCreated {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusCreated)
	}

	// Parse response
	var createdMeal *models.Meal
	if err := json.NewDecoder(rr.Body).Decode(&createdMeal); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	// Verify meal properties
	if createdMeal.ID != expectedMealID {
		t.Errorf("expected meal ID %d, got %d", expectedMealID, createdMeal.ID)
	}
	if createdMeal.MealName != newMeal.MealName {
		t.Errorf("expected meal name %q, got %q", newMeal.MealName, createdMeal.MealName)
	}
	if createdMeal.RelativeEffort != newMeal.RelativeEffort {
		t.Errorf("expected relative effort %d, got %d", newMeal.RelativeEffort, createdMeal.RelativeEffort)
	}
	if createdMeal.RedMeat != newMeal.RedMeat {
		t.Errorf("expected red meat %t, got %t", newMeal.RedMeat, createdMeal.RedMeat)
	}

	// Verify ingredients
	if len(createdMeal.Ingredients) != len(newMeal.Ingredients) {
		t.Fatalf("expected %d ingredients, got %d", len(newMeal.Ingredients), len(createdMeal.Ingredients))
	}

	for i, ing := range createdMeal.Ingredients {
		if ing.ID != expectedIngIDs[i] {
			t.Errorf("ingredient %d: expected ID %d, got %d", i, expectedIngIDs[i], ing.ID)
		}
		if ing.MealID != expectedMealID {
			t.Errorf("ingredient %d: expected meal ID %d, got %d", i, expectedMealID, ing.MealID)
		}
		if ing.Name != newMeal.Ingredients[i].Name {
			t.Errorf("ingredient %d: expected name %q, got %q", i, newMeal.Ingredients[i].Name, ing.Name)
		}
		if ing.Quantity != newMeal.Ingredients[i].Quantity {
			t.Errorf("ingredient %d: expected quantity %f, got %f", i, newMeal.Ingredients[i].Quantity, ing.Quantity)
		}
		if ing.Unit != newMeal.Ingredients[i].Unit {
			t.Errorf("ingredient %d: expected unit %q, got %q", i, newMeal.Ingredients[i].Unit, ing.Unit)
		}
	}

	// Verify all expectations were met
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %s", err)
	}
}

// TestCreateMealHandler_ValidationError tests that meal validation errors are handled properly
func TestCreateMealHandler_ValidationError(t *testing.T) {
	// Create a new sqlmock database connection
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	// Store the original DB and restore it after the test
	originalDB := DB
	DB = db
	defer func() { DB = originalDB }()

	// Create an invalid meal with no name
	invalidMeal := models.Meal{
		MealName:       "", // Invalid: empty name
		RelativeEffort: 2,
		RedMeat:        false,
		Ingredients: []models.Ingredient{
			{Name: "Ingredient 1", Quantity: 1, Unit: "cup"},
		},
	}

	body, err := json.Marshal(invalidMeal)
	if err != nil {
		t.Fatalf("failed to marshal meal: %v", err)
	}

	req, err := http.NewRequest("POST", "/api/meals", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(CreateMealHandler)
	handler.ServeHTTP(rr, req)

	// Check status code is 400 Bad Request
	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusBadRequest)
	}

	expectedError := "Meal name is required\n"
	if rr.Body.String() != expectedError {
		t.Errorf("expected error message %q, got %q", expectedError, rr.Body.String())
	}

	// Verify no expectations were set on the mock
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %s", err)
	}
}

// TestCreateMealHandler_DatabaseError tests handling of database errors during meal creation
func TestCreateMealHandler_DatabaseError(t *testing.T) {
	// Create a new sqlmock database connection
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	// Store the original DB and restore it after the test
	originalDB := DB
	DB = db
	defer func() { DB = originalDB }()

	newMeal := models.Meal{
		MealName:       "Test Recipe",
		RelativeEffort: 2,
		RedMeat:        false,
		Ingredients: []models.Ingredient{
			{Name: "Ingredient 1", Quantity: 1, Unit: "cup"},
		},
	}

	// Set up mock to simulate a database error
	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta("INSERT INTO meals (meal_name, relative_effort, red_meat) VALUES ($1, $2, $3) RETURNING id")).
		WithArgs(newMeal.MealName, newMeal.RelativeEffort, newMeal.RedMeat).
		WillReturnError(errors.New("database error"))
	mock.ExpectRollback()

	// Create request with meal data
	body, err := json.Marshal(newMeal)
	if err != nil {
		t.Fatalf("failed to marshal meal: %v", err)
	}

	req, err := http.NewRequest("POST", "/api/meals", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(CreateMealHandler)
	handler.ServeHTTP(rr, req)

	// Check status code is 500 Internal Server Error
	if status := rr.Code; status != http.StatusInternalServerError {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusInternalServerError)
	}

	// Check error message
	expectedPrefix := "Error creating meal: database error\n"
	if rr.Body.String() != expectedPrefix {
		t.Errorf("expected error message to start with %q, got %q", expectedPrefix, rr.Body.String())
	}

	// Verify all expectations were met
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %s", err)
	}
}
