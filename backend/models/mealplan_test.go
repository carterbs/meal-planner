package models

import (
	"database/sql"
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

	t.Run("normal case without excluding red meat", func(t *testing.T) {
		// Build a regex for the expected query by calling the helper.
		queryRegex := regexp.QuoteMeta(buildPickMealQuery(false))

		// Return a test row using the shared MealColumns.
		rows := sqlmock.NewRows(MealColumns).
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
	})

	t.Run("case excluding red meat", func(t *testing.T) {
		// Build a regex for the expected query with red meat exclusion.
		queryRegex := regexp.QuoteMeta(buildPickMealQuery(true))

		// Return a test row that represents a meal without red meat.
		rows := sqlmock.NewRows(MealColumns).
			AddRow(2, "Non Red Meat Meal", 4, nil, false)

		mock.ExpectQuery(queryRegex).
			WithArgs(3, 5, sqlmock.AnyArg()).
			WillReturnRows(rows)

		meal, err := pickMeal(db, 3, 5, true, cutoff)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if meal.ID != 2 || meal.MealName != "Non Red Meat Meal" {
			t.Errorf("expected meal with id=2 and name 'Non Red Meat Meal', got: %+v", meal)
		}
		if meal.RedMeat {
			t.Errorf("expected redMeat false when excluding red meat, got true")
		}
	})

	t.Run("no meal available", func(t *testing.T) {
		// Build a regex for expected query (normal case).
		queryRegex := regexp.QuoteMeta(buildPickMealQuery(false))

		// Simulate no rows returned by returning sql.ErrNoRows.
		mock.ExpectQuery(queryRegex).
			WithArgs(0, 2, sqlmock.AnyArg()).
			WillReturnError(sql.ErrNoRows)

		_, err := pickMeal(db, 0, 2, false, cutoff)
		if err == nil {
			t.Error("expected error for no meal available, got nil")
		}
	})

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("there were unmet expectations: %s", err)
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
	queryRegex := regexp.QuoteMeta(buildPickMealQuery(false))

	for i, d := range days {
		mock.ExpectQuery(queryRegex).
			WithArgs(d.minEffort, d.maxEffort, sqlmock.AnyArg()).
			WillReturnRows(
				sqlmock.NewRows(MealColumns).
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
