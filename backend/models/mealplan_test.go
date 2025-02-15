package models

import (
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestPickMeal(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to open sqlmock: %v", err)
	}
	defer db.Close()

	cutoff := time.Now().AddDate(0, 0, -21)
	// Build a regex for the expected query.
	queryRegex := regexp.QuoteMeta("SELECT id, meal_name, relative_effort, last_planned, red_meat FROM meals WHERE relative_effort BETWEEN $1 AND $2 AND (last_planned IS NULL OR last_planned < $3) ORDER BY random() LIMIT 1;")

	// Return a test row (id=1, "Test Meal", effort=2, no last_planned, red_meat false)
	rows := sqlmock.NewRows([]string{"id", "meal_name", "relative_effort", "last_planned", "red_meat"}).
		AddRow(1, "Test Meal", 2, nil, false)

	mock.ExpectQuery(queryRegex).
		WithArgs(0, 2, sqlmock.AnyArg()).
		WillReturnRows(rows)

	meal, err := pickMeal(db, 0, 2, false, cutoff)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if meal.ID != 1 || meal.MealName != "Test Meal" {
		t.Errorf("expected meal with id=1 and name 'Test Meal', got: %+v", meal)
	}
}

func TestGenerateWeeklyMealPlan(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to open sqlmock: %v", err)
	}
	defer db.Close()

	// Define the criteria for each day (except Friday, which is hardcoded)
	days := []struct {
		day       string
		minEffort int
		maxEffort int
	}{
		{"Monday", 0, 2},
		{"Tuesday", 3, 5},
		{"Wednesday", 3, 5},
		{"Thursday", 3, 5},
		{"Saturday", 3, 5},
		{"Sunday", 6, 100},
	}

	// For simplicity, assume all selected meals are not red meat.
	queryRegex := regexp.QuoteMeta("SELECT id, meal_name, relative_effort, last_planned, red_meat FROM meals WHERE relative_effort BETWEEN $1 AND $2 AND (last_planned IS NULL OR last_planned < $3) ORDER BY random() LIMIT 1;")

	for i, d := range days {
		mock.ExpectQuery(queryRegex).
			WithArgs(d.minEffort, d.maxEffort, sqlmock.AnyArg()).
			WillReturnRows(
				sqlmock.NewRows([]string{"id", "meal_name", "relative_effort", "last_planned", "red_meat"}).
					AddRow(i+10, d.day+" Meal", (d.minEffort+d.maxEffort)/2, nil, false),
			)
	}

	plan, err := GenerateWeeklyMealPlan(db)
	if err != nil {
		t.Fatalf("GenerateWeeklyMealPlan returned error: %v", err)
	}

	// Check keys exist for all expected days
	expectedDays := []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
	for _, day := range expectedDays {
		if plan[day] == nil {
			t.Errorf("expected a meal for %s, got nil", day)
		}
	}

	// Verify Friday is set to "Eating out"
	if plan["Friday"].MealName != "Eating out" {
		t.Errorf("expected Friday meal to be 'Eating out', got %s", plan["Friday"].MealName)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("there were unmet expectations: %s", err)
	}
}
