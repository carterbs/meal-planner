package models

import (
	"database/sql"
	"fmt"
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
		queryRegex := regexp.QuoteMeta(buildPickMealQuery(false, "dinner"))

		// Return a test row using the shared MealColumns.
		rows := sqlmock.NewRows([]string{"id", "meal_name", "relative_effort", "last_planned", "red_meat", "url", "meal_type"}).
			AddRow(1, "Test Meal", 2, nil, false, "https://example.com/test", "dinner")

		mock.ExpectQuery(queryRegex).
			WithArgs(0, 2, sqlmock.AnyArg(), "dinner").
			WillReturnRows(rows)

		meal, err := pickMeal(db, 0, 2, false, cutoff, "dinner")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if meal.ID != 1 || meal.MealName != "Test Meal" {
			t.Errorf("expected meal with id=1 and name 'Test Meal', got: %+v", meal)
		}
	})

	t.Run("case excluding red meat", func(t *testing.T) {
		// Build a regex for the expected query with red meat exclusion.
		queryRegex := regexp.QuoteMeta(buildPickMealQuery(true, "dinner"))

		// Return a test row that represents a meal without red meat.
		rows := sqlmock.NewRows([]string{"id", "meal_name", "relative_effort", "last_planned", "red_meat", "url", "meal_type"}).
			AddRow(2, "Non Red Meat Meal", 4, nil, false, "https://example.com/nonredmeat", "dinner")

		mock.ExpectQuery(queryRegex).
			WithArgs(3, 5, sqlmock.AnyArg(), "dinner").
			WillReturnRows(rows)

		meal, err := pickMeal(db, 3, 5, true, cutoff, "dinner")
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
		queryRegex := regexp.QuoteMeta(buildPickMealQuery(false, "dinner"))

		// Simulate no rows returned by returning sql.ErrNoRows.
		mock.ExpectQuery(queryRegex).
			WithArgs(0, 2, sqlmock.AnyArg(), "dinner").
			WillReturnError(sql.ErrNoRows)

		meal, err := pickMeal(db, 0, 2, false, cutoff, "dinner")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if meal != nil {
			t.Error("expected nil meal when no meal available, got non-nil")
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

	// Use a more flexible query pattern that matches any meal type
	queryPattern := "SELECT (.+) FROM meals WHERE relative_effort BETWEEN \\$1 AND \\$2 AND \\(last_planned IS NULL OR last_planned < \\$3\\) AND meal_type = \\$4"

	// The function calls breakfast, lunch, dinner for each day in sequence
	// So we need to mock them in the order they're called
	for i, d := range days {
		// Breakfast query for this day
		mock.ExpectQuery(queryPattern).
			WithArgs(0, 2, sqlmock.AnyArg(), "breakfast").
			WillReturnRows(
				sqlmock.NewRows([]string{"id", "meal_name", "relative_effort", "last_planned", "red_meat", "url", "meal_type"}).
					AddRow(i+100, "Breakfast "+string(rune('A'+i)), 1, nil, false, "https://example.com/breakfast", "breakfast"),
			)

		// Lunch query for this day
		mock.ExpectQuery(queryPattern).
			WithArgs(0, 2, sqlmock.AnyArg(), "lunch").
			WillReturnRows(
				sqlmock.NewRows([]string{"id", "meal_name", "relative_effort", "last_planned", "red_meat", "url", "meal_type"}).
					AddRow(i+200, "Lunch "+string(rune('A'+i)), 1, nil, false, "https://example.com/lunch", "lunch"),
			)

		// Dinner query for this day
		mock.ExpectQuery(queryPattern).
			WithArgs(d.minEffort, d.maxEffort, sqlmock.AnyArg(), "dinner").
			WillReturnRows(
				sqlmock.NewRows([]string{"id", "meal_name", "relative_effort", "last_planned", "red_meat", "url", "meal_type"}).
					AddRow(i+10, d.day+" Dinner", (d.minEffort+d.maxEffort)/2, nil, false, "https://example.com/"+d.day, "dinner"),
			)
	}

	plan, err := GenerateWeeklyMealPlan(db)
	if err != nil {
		t.Fatalf("GenerateWeeklyMealPlan returned error: %v", err)
	}

	// Verify plan is not nil
	if plan == nil {
		t.Fatal("expected non-nil plan")
	}

	// Check that meals exist for each day (using struct fields)
	if plan.Monday.Dinner == nil {
		t.Errorf("expected a dinner meal for Monday, got nil")
	}
	if plan.Tuesday.Dinner == nil {
		t.Errorf("expected a dinner meal for Tuesday, got nil")
	}
	if plan.Wednesday.Dinner == nil {
		t.Errorf("expected a dinner meal for Wednesday, got nil")
	}
	if plan.Thursday.Dinner == nil {
		t.Errorf("expected a dinner meal for Thursday, got nil")
	}
	if plan.Saturday.Dinner == nil {
		t.Errorf("expected a dinner meal for Saturday, got nil")
	}
	if plan.Sunday.Dinner == nil {
		t.Errorf("expected a dinner meal for Sunday, got nil")
	}

	// Verify Friday is set to "Eating out"
	if plan.Friday.Dinner == nil || plan.Friday.Dinner.MealName != "Eating out" {
		t.Errorf("expected Friday dinner to be 'Eating out', got %v", plan.Friday.Dinner)
	}

	// Verify breakfast and lunch are set for Monday (as an example)
	if plan.Monday.Breakfast == nil {
		t.Errorf("expected a breakfast meal for Monday, got nil")
	}
	if plan.Monday.Lunch == nil {
		t.Errorf("expected a lunch meal for Monday, got nil")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("there were unmet expectations: %s", err)
	}
}

func TestGetLastPlannedMeals(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to open sqlmock: %v", err)
	}
	defer db.Close()

	t.Run("successful retrieval of last planned meals", func(t *testing.T) {
		// Example planned dates for meals
		now := time.Now()
		lastPlannedDates := []time.Time{
			now.AddDate(0, 0, -1), // Yesterday
			now.AddDate(0, 0, -2), // 2 days ago
			now.AddDate(0, 0, -3), // 3 days ago
			now.AddDate(0, 0, -4), // 4 days ago
			now.AddDate(0, 0, -5), // 5 days ago
			now.AddDate(0, 0, -6), // 6 days ago
		}

		// Mock breakfast query
		breakfastRows := sqlmock.NewRows([]string{"id", "meal_name", "relative_effort", "last_planned", "red_meat", "url", "meal_type"})
		for i := 0; i < 6; i++ {
			breakfastRows.AddRow(i+100, fmt.Sprintf("Breakfast %d", i+1), 1, lastPlannedDates[i], false, "https://example.com/breakfast", "breakfast")
		}
		mock.ExpectQuery("SELECT (.+) FROM meals WHERE meal_type = \\$1 AND last_planned IS NOT NULL ORDER BY last_planned DESC LIMIT \\$2").
			WithArgs("breakfast", 6).
			WillReturnRows(breakfastRows)

		// Mock lunch query
		lunchRows := sqlmock.NewRows([]string{"id", "meal_name", "relative_effort", "last_planned", "red_meat", "url", "meal_type"})
		for i := 0; i < 6; i++ {
			lunchRows.AddRow(i+200, fmt.Sprintf("Lunch %d", i+1), 2, lastPlannedDates[i], false, "https://example.com/lunch", "lunch")
		}
		mock.ExpectQuery("SELECT (.+) FROM meals WHERE meal_type = \\$1 AND last_planned IS NOT NULL ORDER BY last_planned DESC LIMIT \\$2").
			WithArgs("lunch", 6).
			WillReturnRows(lunchRows)

		// Mock dinner query - note that the function reverses the order, so we need to add them in reverse
		dinnerRows := sqlmock.NewRows([]string{"id", "meal_name", "relative_effort", "last_planned", "red_meat", "url", "meal_type"})
		dinnerRows.AddRow(6, "Sunday Dinner", 7, lastPlannedDates[5], false, "https://example.com/sunday", "dinner")
		dinnerRows.AddRow(5, "Saturday Dinner", 5, lastPlannedDates[4], true, "https://example.com/saturday", "dinner")
		dinnerRows.AddRow(4, "Thursday Dinner", 3, lastPlannedDates[3], false, "https://example.com/thursday", "dinner")
		dinnerRows.AddRow(3, "Wednesday Dinner", 4, lastPlannedDates[2], true, "https://example.com/wednesday", "dinner")
		dinnerRows.AddRow(2, "Tuesday Dinner", 3, lastPlannedDates[1], false, "https://example.com/tuesday", "dinner")
		dinnerRows.AddRow(1, "Monday Dinner", 2, lastPlannedDates[0], false, "https://example.com/monday", "dinner")
		mock.ExpectQuery("SELECT (.+) FROM meals WHERE meal_type = \\$1 AND last_planned IS NOT NULL ORDER BY last_planned DESC LIMIT \\$2").
			WithArgs("dinner", 6).
			WillReturnRows(dinnerRows)

		// Call the function
		mealPlan, err := GetLastPlannedMeals(db)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// Verify plan is not nil
		if mealPlan == nil {
			t.Fatal("expected non-nil meal plan")
		}

		// Check that meals exist for each day (using struct fields)
		if mealPlan.Monday.Breakfast == nil {
			t.Errorf("expected a breakfast meal for Monday, got nil")
		}
		if mealPlan.Monday.Lunch == nil {
			t.Errorf("expected a lunch meal for Monday, got nil")
		}
		if mealPlan.Monday.Dinner == nil {
			t.Errorf("expected a dinner meal for Monday, got nil")
		}

		// Check specific meal data
		if mealPlan.Monday.Dinner != nil && (mealPlan.Monday.Dinner.ID != 1 || mealPlan.Monday.Dinner.MealName != "Monday Dinner") {
			t.Errorf("unexpected dinner for Monday: %+v", mealPlan.Monday.Dinner)
		}

		// Friday should always be "Eating out"
		if mealPlan.Friday.Dinner == nil || mealPlan.Friday.Dinner.MealName != "Eating out" {
			t.Errorf("expected Friday dinner to be 'Eating out', got: %+v", mealPlan.Friday.Dinner)
		}
	})

	t.Run("not enough meals found", func(t *testing.T) {
		// Mock breakfast query with insufficient meals
		breakfastRows := sqlmock.NewRows([]string{"id", "meal_name", "relative_effort", "last_planned", "red_meat", "url", "meal_type"})
		breakfastRows.AddRow(1, "Breakfast 1", 1, time.Now(), false, "https://example.com/breakfast", "breakfast")
		breakfastRows.AddRow(2, "Breakfast 2", 1, time.Now().AddDate(0, 0, -1), false, "https://example.com/breakfast", "breakfast")
		mock.ExpectQuery("SELECT (.+) FROM meals WHERE meal_type = \\$1 AND last_planned IS NOT NULL ORDER BY last_planned DESC LIMIT \\$2").
			WithArgs("breakfast", 6).
			WillReturnRows(breakfastRows)

		// Call the function
		_, err := GetLastPlannedMeals(db)

		// Function should return an error because fewer than 6 meals were found
		if err == nil {
			t.Error("expected an error due to insufficient meals, got nil")
		}
	})

	t.Run("no last planned meals", func(t *testing.T) {
		// Mock breakfast query with no rows
		breakfastRows := sqlmock.NewRows([]string{"id", "meal_name", "relative_effort", "last_planned", "red_meat", "url", "meal_type"})
		mock.ExpectQuery("SELECT (.+) FROM meals WHERE meal_type = \\$1 AND last_planned IS NOT NULL ORDER BY last_planned DESC LIMIT \\$2").
			WithArgs("breakfast", 6).
			WillReturnRows(breakfastRows)

		// Call the function
		_, err := GetLastPlannedMeals(db)

		// Function should return an error because no meals were found
		if err == nil {
			t.Error("expected an error due to no meals, got nil")
		}
	})

	t.Run("database error", func(t *testing.T) {
		mock.ExpectQuery("SELECT (.+) FROM meals WHERE meal_type = \\$1 AND last_planned IS NOT NULL ORDER BY last_planned DESC LIMIT \\$2").
			WithArgs("breakfast", 6).
			WillReturnError(sql.ErrConnDone)

		// Call the function
		_, err := GetLastPlannedMeals(db)
		if err == nil {
			t.Fatal("expected an error, got nil")
		}
	})

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("there were unmet expectations: %s", err)
	}
}
