package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/go-chi/chi/v5"
	"github.com/lib/pq"

	"google.golang.org/protobuf/encoding/protojson"
	apipb "mealplanner/generated/go"
	"mealplanner/models"
	"mealplanner/services"
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

	// Store the original DB and Services
	originalDB := DB
	originalServices := Services
	DB = db
	Services = services.NewServiceContainer(db)

	// Restore the originals after the test
	t.Cleanup(func() {
		db.Close()
		DB = originalDB
		Services = originalServices
	})

	return &testHelper{db, mock}
}

// expectMealQuery sets up expectations for a meal query
func (h *testHelper) expectMealQuery(queryRegex string, args ...interface{}) *sqlmock.Rows {
	rows := sqlmock.NewRows([]string{
		"id", "meal_name", "relative_effort", "last_planned", "red_meat", "url", "meal_type",
		"ingredient_id", "name", "quantity", "unit",
	})

	expectation := h.mock.ExpectQuery(regexp.QuoteMeta(queryRegex))
	if len(args) > 0 {
		expectation.WithArgs(args[0]) // Handle single argument case
	}
	expectation.WillReturnRows(rows)

	return rows
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
	rows.AddRow(1, "Meal A", 2, now, false, "https://example.com/meala", "dinner", 1, "Eggs", 0, "dozen")
	rows.AddRow(2, "Meal B", 3, now, true, "https://example.com/mealb", "dinner", 2, "Milk", 2.5, "gallon")
	rows.AddRow(2, "Meal B", 3, now, true, "https://example.com/mealb", "dinner", 3, "Bread", 0, "loaf")

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
	var resp apipb.GetAllMealsResponse
	if err := protojson.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("could not decode response: %v", err)
	}
	meals := resp.Meals

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
		Id:       1,
		Name:     "Sugar",
		Quantity: 2.0,
		Unit:     "cup",
	}

	// Expect a single UPDATE query using SQL from the model file
	helper.mock.ExpectExec(regexp.QuoteMeta("UPDATE ingredients SET name=$1, quantity=$2, unit=$3 WHERE id=$4 AND meal_id=$5")).
		WithArgs(updatedIngredient.Name, updatedIngredient.Quantity, updatedIngredient.Unit, updatedIngredient.Id, mealID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Expect query to return updated meal
	now := time.Now()
	rows := helper.expectMealQuery(models.GetMealsByIDsQuery, pq.Array([]int{mealID}))
	rows.AddRow(mealID, "Test Meal", 1, now, false, "https://example.com/test", "dinner", 1, updatedIngredient.Name, updatedIngredient.Quantity, updatedIngredient.Unit)
	stepsRows := sqlmock.NewRows([]string{"id", "meal_id", "step_number", "instruction"})
	helper.mock.ExpectQuery(regexp.QuoteMeta("SELECT id, meal_id, step_number, instruction FROM recipe_steps WHERE meal_id = $1 ORDER BY step_number")).WithArgs(mealID).WillReturnRows(stepsRows)

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
	var resp apipb.UpdateMealIngredientResponse
	if err := protojson.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	ingredients := resp.Meal.GetIngredients()

	if len(ingredients) != 1 {
		t.Errorf("expected 1 ingredient, got %d", len(ingredients))
	}
	if ingredients[0].GetQuantity() != updatedIngredient.Quantity {
		t.Errorf("expected quantity %v, got %v", updatedIngredient.Quantity, ingredients[0].GetQuantity())
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
	rows.AddRow(mealID, "Test Meal", 1, now, false, "https://example.com/test", "dinner", 2, "Pepper", 0.5, "tsp")
	stepsRows := sqlmock.NewRows([]string{"id", "meal_id", "step_number", "instruction"})
	helper.mock.ExpectQuery(regexp.QuoteMeta("SELECT id, meal_id, step_number, instruction FROM recipe_steps WHERE meal_id = $1 ORDER BY step_number")).WithArgs(mealID).WillReturnRows(stepsRows)

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
	var resp apipb.DeleteMealIngredientResponse
	if err := protojson.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	ingredients := resp.Meal.GetIngredients()

	// Verify meal data
	if len(ingredients) != 1 {
		t.Errorf("expected 1 ingredient remaining, got %d", len(ingredients))
	}
	if ingredients[0].GetName() != "Pepper" {
		t.Errorf("expected remaining ingredient to be 'Pepper', got %s", ingredients[0].GetName())
	}

	// Verify all expectations were met
	if err := helper.mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %s", err)
	}
}

func TestDeleteMealHandler(t *testing.T) {
	helper := setupTest(t)

	mealID := 1

	// Expect transaction
	helper.mock.ExpectBegin()

	// First expect deletion of recipe steps
	helper.mock.ExpectExec("DELETE FROM recipe_steps WHERE meal_id = \\$1").
		WithArgs(mealID).
		WillReturnResult(sqlmock.NewResult(0, 2)) // 2 steps deleted

	// Next expect deletion of ingredients
	helper.mock.ExpectExec("DELETE FROM ingredients WHERE meal_id = \\$1").
		WithArgs(mealID).
		WillReturnResult(sqlmock.NewResult(0, 2)) // 2 ingredients deleted

	// Finally expect deletion of meal
	helper.mock.ExpectExec("DELETE FROM meals WHERE id = \\$1").
		WithArgs(mealID).
		WillReturnResult(sqlmock.NewResult(0, 1)) // 1 meal deleted

	// Expect commit
	helper.mock.ExpectCommit()

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
	if err := helper.mock.ExpectationsWereMet(); err != nil {
		t.Errorf("there were unfulfilled expectations: %s", err)
	}
}

// Add test for error cases
func TestDeleteMealHandlerErrors(t *testing.T) {
	tests := []struct {
		name         string
		mealID       string
		setupMock    func(mock sqlmock.Sqlmock)
		expectedCode int
		expectedBody string
	}{
		{
			name:   "meal not found",
			mealID: "999",
			setupMock: func(mock sqlmock.Sqlmock) {
				mock.ExpectBegin()
				mock.ExpectExec("DELETE FROM recipe_steps WHERE meal_id = \\$1").
					WithArgs(999).
					WillReturnResult(sqlmock.NewResult(0, 0))
				mock.ExpectExec("DELETE FROM ingredients WHERE meal_id = \\$1").
					WithArgs(999).
					WillReturnResult(sqlmock.NewResult(0, 0))
				mock.ExpectExec("DELETE FROM meals WHERE id = \\$1").
					WithArgs(999).
					WillReturnResult(sqlmock.NewResult(0, 0))
				// When no rows are affected, the transaction should still commit
				mock.ExpectRollback()
				// Return a specific error for meal not found
				// This simulates the behavior in the models.DeleteMeal function
			},
			expectedCode: http.StatusInternalServerError,
			expectedBody: "failed to delete meal with ID 999: meal not found\n",
		},
		{
			name:   "database error",
			mealID: "1",
			setupMock: func(mock sqlmock.Sqlmock) {
				mock.ExpectBegin()
				mock.ExpectExec("DELETE FROM recipe_steps WHERE meal_id = \\$1").
					WithArgs(1).
					WillReturnError(fmt.Errorf("database error"))
				mock.ExpectRollback()
			},
			expectedCode: http.StatusInternalServerError,
			expectedBody: "failed to delete meal with ID 1: database error\n",
		},
		{
			name:   "invalid id",
			mealID: "abc",
			setupMock: func(mock sqlmock.Sqlmock) {
				// No DB interactions expected
			},
			expectedCode: http.StatusBadRequest,
			expectedBody: "Invalid meal ID\n",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			helper := setupTest(t)

			// Setup mock expectations
			tt.setupMock(helper.mock)

			// Create request
			req, err := createRequest("DELETE", fmt.Sprintf("/api/meals/%s", tt.mealID), nil)
			if err != nil {
				t.Fatalf("failed to create request: %v", err)
			}

			// Add URL parameters
			req = addURLParams(req, map[string]string{
				"mealId": tt.mealID,
			})

			// Execute request
			rr := httptest.NewRecorder()
			handler := http.HandlerFunc(DeleteMealHandler)
			handler.ServeHTTP(rr, req)

			// Check response status
			if status := rr.Code; status != tt.expectedCode {
				t.Errorf("handler returned wrong status code: got %v want %v", status, tt.expectedCode)
			}

			// Check response body
			if rr.Body.String() != tt.expectedBody {
				t.Errorf("handler returned unexpected error: got %v want %v", rr.Body.String(), tt.expectedBody)
			}

			// Verify all expectations were met
			if err := helper.mock.ExpectationsWereMet(); err != nil {
				t.Errorf("there were unfulfilled expectations: %s", err)
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
			payload: `{"days":[{"dayIndex":0,"mealType":"dinner","meal":{"id":1}},{"dayIndex":1,"mealType":"dinner","meal":{"id":2}}]}`,
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
			expectedBody: "Meal plan finalized successfully.",
		},
		{
			name:         "invalid json payload",
			payload:      `{invalid json}`,
			setupMock:    func(mock sqlmock.Sqlmock) {},
			expectedCode: http.StatusBadRequest,
			expectedBody: "Invalid request payload: invalid character 'i' looking for beginning of object key string\n",
		},
		{
			name:    "database error",
			payload: `{"days":[{"dayIndex":0,"mealType":"dinner","meal":{"id":1}}]}`,
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
			expectedBody: "Failed to finalize meal plan: failed to update last planned dates for meal IDs [1]: database error\n",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			helper := setupTest(t)

			// Setup mock expectations
			tt.setupMock(helper.mock)

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

			if err := helper.mock.ExpectationsWereMet(); err != nil {
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

	// Store the original DB and Services and restore them after the test
	originalDB := DB
	originalServices := Services
	DB = db
	Services = services.NewServiceContainer(db)
	defer func() {
		DB = originalDB
		Services = originalServices
	}()

	// Setup rows with meals in non-alphabetical order
	rows := sqlmock.NewRows([]string{
		"id", "meal_name", "relative_effort", "last_planned", "red_meat", "url", "meal_type",
		"ingredient_id", "name", "quantity", "unit",
	}).
		AddRow(1, "Zucchini Pasta", 2, nil, false, "https://example.com/zucchini", "dinner", nil, nil, nil, nil).
		AddRow(2, "apple pie", 3, nil, false, "https://example.com/apple", "dinner", nil, nil, nil, nil).
		AddRow(3, "Meatballs", 4, nil, true, "https://example.com/meatballs", "dinner", nil, nil, nil, nil).
		AddRow(4, "banana bread", 2, nil, false, "https://example.com/banana", "dinner", nil, nil, nil, nil)

	// Expect the query
	mock.ExpectQuery(regexp.QuoteMeta(models.GetAllMealsQuery)).
		WillReturnRows(rows)

	// Mock the step queries for each meal (GetStepsForMeal is called for each meal in the service layer)
	stepRows := sqlmock.NewRows([]string{"id", "meal_id", "step_number", "instruction"})
	mock.ExpectQuery("SELECT id, meal_id, step_number, instruction FROM recipe_steps WHERE meal_id = \\$1 ORDER BY step_number").
		WithArgs(1).WillReturnRows(stepRows)
	mock.ExpectQuery("SELECT id, meal_id, step_number, instruction FROM recipe_steps WHERE meal_id = \\$1 ORDER BY step_number").
		WithArgs(2).WillReturnRows(stepRows)
	mock.ExpectQuery("SELECT id, meal_id, step_number, instruction FROM recipe_steps WHERE meal_id = \\$1 ORDER BY step_number").
		WithArgs(3).WillReturnRows(stepRows)
	mock.ExpectQuery("SELECT id, meal_id, step_number, instruction FROM recipe_steps WHERE meal_id = \\$1 ORDER BY step_number").
		WithArgs(4).WillReturnRows(stepRows)

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
	var resp apipb.GetAllMealsResponse
	if err := protojson.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("couldn't parse response: %v", err)
	}
	meals := resp.GetMeals()

	// Verify meals are sorted alphabetically (case-insensitive)
	expectedOrder := []string{"apple pie", "banana bread", "Meatballs", "Zucchini Pasta"}
	if len(meals) != len(expectedOrder) {
		t.Fatalf("expected %d meals, got %d", len(expectedOrder), len(meals))
	}

	for i, expectedName := range expectedOrder {
		if meals[i].GetName() != expectedName {
			t.Errorf("meal at position %d: expected %q, got %q", i, expectedName, meals[i].GetName())
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

	// Store the original DB and Services and restore them after the test
	originalDB := DB
	originalServices := Services
	DB = db
	Services = services.NewServiceContainer(db)
	defer func() {
		DB = originalDB
		Services = originalServices
	}()

	// Create a test meal with ingredients
	newMeal := models.Meal{
		Name:       "Test Recipe",
		Effort:     2,
		HasRedMeat: false,
		Url:        "https://example.com/test-recipe",
		Ingredients: []*models.Ingredient{
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
	mock.ExpectQuery(regexp.QuoteMeta("INSERT INTO meals (meal_name, relative_effort, red_meat, url, meal_type) VALUES ($1, $2, $3, $4, $5) RETURNING id")).
		WithArgs(newMeal.Name, newMeal.Effort, newMeal.HasRedMeat, newMeal.Url, "dinner").
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
	reqProto := &apipb.CreateMealRequest{Meal: &newMeal}
	body, err := protojson.MarshalOptions{UseProtoNames: true}.Marshal(reqProto)
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
	var resp apipb.CreateMealResponse
	if err := protojson.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	createdMeal := resp.GetMeal()

	// Verify meal properties
	if createdMeal.Id != int32(expectedMealID) {
		t.Errorf("expected meal ID %d, got %d", expectedMealID, createdMeal.Id)
	}
	if createdMeal.Name != newMeal.Name {
		t.Errorf("expected meal name %q, got %q", newMeal.Name, createdMeal.Name)
	}
	if createdMeal.Effort != newMeal.Effort {
		t.Errorf("expected relative effort %d, got %d", newMeal.Effort, createdMeal.Effort)
	}
	if createdMeal.HasRedMeat != newMeal.HasRedMeat {
		t.Errorf("expected red meat %t, got %t", newMeal.HasRedMeat, createdMeal.HasRedMeat)
	}
	if createdMeal.Url != newMeal.Url {
		t.Errorf("expected URL %q, got %q", newMeal.Url, createdMeal.Url)
	}

	// Verify ingredients
	if len(createdMeal.Ingredients) != len(newMeal.Ingredients) {
		t.Fatalf("expected %d ingredients, got %d", len(newMeal.Ingredients), len(createdMeal.Ingredients))
	}

	for i, ing := range createdMeal.Ingredients {
		if ing.Id != int32(expectedIngIDs[i]) {
			t.Errorf("ingredient %d: expected ID %d, got %d", i, expectedIngIDs[i], ing.Id)
		}
		if ing.MealId != int32(expectedMealID) {
			t.Errorf("ingredient %d: expected meal ID %d, got %d", i, expectedMealID, ing.MealId)
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

	// Store the original DB and Services and restore them after the test
	originalDB := DB
	originalServices := Services
	DB = db
	Services = services.NewServiceContainer(db)
	defer func() {
		DB = originalDB
		Services = originalServices
	}()

	// Create an invalid meal with no name
	invalidMeal := models.Meal{
		Name:       "", // Invalid: empty name
		Effort:     2,
		HasRedMeat: false,
		Url:        "https://example.com/test-recipe",
		Ingredients: []*models.Ingredient{
			{Name: "Ingredient 1", Quantity: 1, Unit: "cup"},
		},
	}

	reqProto := &apipb.CreateMealRequest{Meal: &invalidMeal}
	body, err := protojson.MarshalOptions{UseProtoNames: true}.Marshal(reqProto)
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

	// Store the original DB and Services and restore them after the test
	originalDB := DB
	originalServices := Services
	DB = db
	Services = services.NewServiceContainer(db)
	defer func() {
		DB = originalDB
		Services = originalServices
	}()

	newMeal := models.Meal{
		Name:       "Test Recipe",
		Effort:     2,
		HasRedMeat: false,
		Url:        "https://example.com/test-recipe",
		Ingredients: []*models.Ingredient{
			{Name: "Ingredient 1", Quantity: 1, Unit: "cup"},
		},
	}

	// Set up mock to simulate a database error
	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta("INSERT INTO meals (meal_name, relative_effort, red_meat, url, meal_type) VALUES ($1, $2, $3, $4, $5) RETURNING id")).
		WithArgs(newMeal.Name, newMeal.Effort, newMeal.HasRedMeat, newMeal.Url, "dinner").
		WillReturnError(errors.New("database error"))
	mock.ExpectRollback()

	// Create request with meal data
	reqProto := &apipb.CreateMealRequest{Meal: &newMeal}
	body, err := protojson.MarshalOptions{UseProtoNames: true}.Marshal(reqProto)
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
	expectedPrefix := "Error creating meal: failed to create meal: database error\n"
	if rr.Body.String() != expectedPrefix {
		t.Errorf("expected error message to start with %q, got %q", expectedPrefix, rr.Body.String())
	}

	// Verify all expectations were met
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %s", err)
	}
}

func TestRemoveMealHandler(t *testing.T) {
	helper := setupTest(t)

	plan := models.WeeklyMealPlan{
		Days: []models.PlanDay{{DayIndex: 0, MealType: "breakfast", Meal: &models.Meal{Id: 1, Name: "Egg"}}},
	}
	checkpointStruct := map[string]interface{}{
		"channel_values": map[string]interface{}{
			"meal_plan": plan,
		},
	}
	checkpointBytes, _ := json.Marshal(checkpointStruct)
	rows1 := sqlmock.NewRows([]string{"checkpoint_data", "checkpoint_ns"}).
		AddRow(checkpointBytes, "latest")
	rows2 := sqlmock.NewRows([]string{"checkpoint_data", "checkpoint_ns"}).
		AddRow(checkpointBytes, "latest")
	rows3 := sqlmock.NewRows([]string{"checkpoint_data", "checkpoint_ns"}).
		AddRow(checkpointBytes, "latest")
	helper.mock.ExpectQuery("SELECT checkpoint_data, checkpoint_ns").WithArgs("thread1").WillReturnRows(rows1) // GetMealPlan
	helper.mock.ExpectQuery("SELECT checkpoint_data, checkpoint_ns").WithArgs("thread1").WillReturnRows(rows2) // UpdateMealPlan -> GetWorkflowState
	helper.mock.ExpectQuery("SELECT checkpoint_data, checkpoint_ns").WithArgs("thread1").WillReturnRows(rows3) // UpdateWorkflowState

	helper.mock.ExpectExec("INSERT INTO workflow_checkpoints").WithArgs("thread1", sqlmock.AnyArg()).WillReturnResult(sqlmock.NewResult(0, 1))

	// Initialize workflow service for the test
	originalService := WorkflowService
	defer func() { WorkflowService = originalService }()
	WorkflowService = services.NewWorkflowService(helper.db)

	reqBody := map[string]interface{}{"threadId": "thread1", "dayIndex": 0, "mealType": "breakfast"}
	bodyBytes, _ := json.Marshal(reqBody)
	req, err := http.NewRequest("POST", "/api/meals/remove", bytes.NewReader(bodyBytes))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(RemoveMealHandler)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d. Response body: %s", rr.Code, rr.Body.String())
	}
	var respRemove apipb.RemoveMealResponse
	if err := protojson.Unmarshal(rr.Body.Bytes(), &respRemove); err != nil {
		t.Fatalf("failed decoding response: %v", err)
	}
	out := respRemove.Plan
	if len(out.Days) == 0 || out.Days[0].Meal != nil {
		t.Errorf("expected meal removed")
	}
	if err := helper.mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}
