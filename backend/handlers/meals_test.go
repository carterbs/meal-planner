package handlers

import (
	"bytes"
	"context"
	"encoding/json"
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
