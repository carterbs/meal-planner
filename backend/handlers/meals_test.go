package handlers

import (
	"bytes"
	"context"
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

func TestGetAllMealsHandler(t *testing.T) {
	// Create a new sqlmock database connection.
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to open sqlmock: %v", err)
	}
	defer db.Close()

	// Set the global DB used by handlers.
	DB = db

	// Setup rows for two meals:
	// Meal A: one ingredient ("Eggs") with empty quantity.
	// Meal B: two rows; one for "Milk" with valid quantity and one for "Bread" with empty quantity.
	now := time.Now()
	rows := sqlmock.NewRows([]string{
		"id", "meal_name", "relative_effort", "last_planned", "red_meat", "ingredient_id", "name", "quantity", "unit",
	}).
		AddRow(1, "Meal A", 2, now, false, 1, "Eggs", 0, "dozen").
		AddRow(2, "Meal B", 3, now, true, 2, "Milk", 2.5, "gallon").
		AddRow(2, "Meal B", 3, now, true, 3, "Bread", 0, "loaf")

	// Expect the shared query for all meals.
	mock.ExpectQuery(regexp.QuoteMeta(models.GetAllMealsQuery)).WillReturnRows(rows)

	// Create a new HTTP request to GET /api/meals.
	req, err := http.NewRequest("GET", "/api/meals", nil)
	if err != nil {
		t.Fatalf("could not create request: %v", err)
	}
	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(GetAllMealsHandler)
	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Decode response.
	var meals []*models.Meal
	if err := json.NewDecoder(rr.Body).Decode(&meals); err != nil {
		t.Fatalf("could not decode response: %v", err)
	}

	if len(meals) != 2 {
		t.Errorf("expected 2 meals, got %d", len(meals))
	}
	// Further detailed assertions can be added here as needed.
}

// TestUpdateMealIngredientHandler verifies that sending a PUT request to update an ingredient
// results in a proper update via the DB transaction and returns the updated meal.
func TestUpdateMealIngredientHandler(t *testing.T) {
	// Create a new sqlmock database connection.
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to open sqlmock: %v", err)
	}
	defer db.Close()

	// Set the global DB used by handlers.
	DB = db

	mealID := 1
	updatedIngredient := models.Ingredient{
		ID:       1,
		Name:     "Sugar",
		Quantity: 2.0,
		Unit:     "cup",
	}

	// Expect a single UPDATE query
	mock.ExpectExec(regexp.QuoteMeta("UPDATE ingredients SET name=$1, quantity=$2, unit=$3 WHERE id=$4 AND meal_id=$5")).
		WithArgs(updatedIngredient.Name, updatedIngredient.Quantity, updatedIngredient.Unit, updatedIngredient.ID, mealID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Expect query to return updated meal.
	now := time.Now()
	rows := sqlmock.NewRows([]string{
		"id", "meal_name", "relative_effort", "last_planned", "red_meat", "ingredient_id", "name", "quantity", "unit",
	}).
		AddRow(mealID, "Test Meal", 1, now, false, 1, updatedIngredient.Name, updatedIngredient.Quantity, updatedIngredient.Unit)
	mock.ExpectQuery(regexp.QuoteMeta(models.GetMealsByIDsQuery)).
		WithArgs(pq.Array([]int{mealID})).
		WillReturnRows(rows)

	// Create a PUT request to update the ingredient.
	body, err := json.Marshal(updatedIngredient)
	if err != nil {
		t.Fatalf("failed to marshal updated ingredient: %v", err)
	}

	req, err := http.NewRequest("PUT", "/api/meals/1/ingredients/1", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("mealId", "1")
	rctx.URLParams.Add("ingredientId", "1")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(UpdateMealIngredientHandler)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

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
}

// TestDeleteMealIngredientHandler verifies that sending a DELETE request for an ingredient
// properly deletes it and returns the updated meal.
func TestDeleteMealIngredientHandler(t *testing.T) {
	// Create a new sqlmock database connection.
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to open sqlmock: %v", err)
	}
	defer db.Close()

	// Set the global DB used by handlers.
	DB = db

	mealID := 1

	// Expect deletion of ingredient "Salt" (index 0).
	mock.ExpectExec(regexp.QuoteMeta("DELETE FROM ingredients WHERE id = $1")).
		WithArgs(1).
		WillReturnResult(sqlmock.NewResult(1, 1))

	// Then, expect a query to return the updated meal with only one ingredient ("Pepper").
	now := time.Now()
	rowsAfter := sqlmock.NewRows([]string{
		"id", "meal_name", "relative_effort", "last_planned", "red_meat", "ingredient_id", "name", "quantity", "unit",
	}).
		AddRow(mealID, "Test Meal", 1, now, false, 2, "Pepper", 0.5, "tsp")

	mock.ExpectQuery(regexp.QuoteMeta(models.GetMealsByIDsQuery)).
		WithArgs(pq.Array([]int{mealID})).
		WillReturnRows(rowsAfter)

	// Create a DELETE request to remove the ingredient at index 1.
	req, err := http.NewRequest("DELETE", "/api/meals/1/ingredients/1", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("mealId", "1")
	rctx.URLParams.Add("ingredientId", "1")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(DeleteMealIngredientHandler)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var meal models.Meal
	if err := json.NewDecoder(rr.Body).Decode(&meal); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(meal.Ingredients) != 1 {
		t.Errorf("expected 1 ingredient remaining, got %d", len(meal.Ingredients))
	}
	if meal.Ingredients[0].Name == "Salt" {
		t.Errorf("expected ingredient 'Salt' to be deleted")
	}
}

func TestDeleteMealHandler(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to open sqlmock: %v", err)
	}
	defer db.Close()

	DB = db

	// Expect transaction to begin
	mock.ExpectBegin()

	// Expect deletion of ingredients first
	mock.ExpectExec(regexp.QuoteMeta("DELETE FROM ingredients WHERE meal_id = $1")).
		WithArgs(1).
		WillReturnResult(sqlmock.NewResult(0, 2)) // 2 ingredients deleted

	// Then expect deletion of meal
	mock.ExpectExec(regexp.QuoteMeta("DELETE FROM meals WHERE id = $1")).
		WithArgs(1).
		WillReturnResult(sqlmock.NewResult(0, 1)) // 1 meal deleted

	// Expect transaction to commit
	mock.ExpectCommit()

	req, err := http.NewRequest("DELETE", "/api/meals/1", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("mealId", "1")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(DeleteMealHandler)
	handler.ServeHTTP(rr, req)

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
