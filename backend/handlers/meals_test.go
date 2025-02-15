package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"
	"time"

	"mealplanner/models"

	"github.com/DATA-DOG/go-sqlmock"
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
		"id", "meal_name", "relative_effort", "last_planned", "red_meat", "name", "quantity", "unit",
	}).
		AddRow(1, "Meal A", 2, now, false, "Eggs", 0, "dozen").
		AddRow(2, "Meal B", 3, now, true, "Milk", 2.5, "gallon").
		AddRow(2, "Meal B", 3, now, true, "Bread", 0, "loaf")

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
