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
		rows := sqlmock.NewRows([]string{"id", "meal_name", "relative_effort", "last_planned", "red_meat", "url"}).
			AddRow(1, "Test Meal", 2, nil, false, "https://example.com/test")

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
		rows := sqlmock.NewRows([]string{"id", "meal_name", "relative_effort", "last_planned", "red_meat", "url"}).
			AddRow(2, "Non Red Meat Meal", 4, nil, false, "https://example.com/nonredmeat")

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
				sqlmock.NewRows([]string{"id", "meal_name", "relative_effort", "last_planned", "red_meat", "url"}).
					AddRow(i+10, d.day+" Meal", (d.minEffort+d.maxEffort)/2, nil, false, "https://example.com/"+d.day),
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
			now.AddDate(0, 0, -7), // 7 days ago
		}

		// Setup expected query and result
		rows := sqlmock.NewRows([]string{"id", "meal_name", "relative_effort", "last_planned", "red_meat", "url"})

		// Add rows for each day of the week
		rows.AddRow(1, "Monday Meal", 2, lastPlannedDates[0], false, "https://example.com/monday")
		rows.AddRow(2, "Tuesday Meal", 3, lastPlannedDates[1], false, "https://example.com/tuesday")
		rows.AddRow(3, "Wednesday Meal", 4, lastPlannedDates[2], true, "https://example.com/wednesday")
		rows.AddRow(4, "Thursday Meal", 3, lastPlannedDates[3], false, "https://example.com/thursday")
		rows.AddRow(5, "Friday Meal", 1, lastPlannedDates[4], false, "https://example.com/friday")
		rows.AddRow(6, "Saturday Meal", 5, lastPlannedDates[5], true, "https://example.com/saturday")
		rows.AddRow(7, "Sunday Meal", 7, lastPlannedDates[6], false, "https://example.com/sunday")

		queryRegex := regexp.QuoteMeta(`
			SELECT id, meal_name, relative_effort, last_planned, red_meat, url
			FROM meals
			WHERE last_planned IS NOT NULL
			ORDER BY last_planned DESC
			LIMIT 7
		`)

		mock.ExpectQuery(queryRegex).WillReturnRows(rows)

		// Call the function
		mealPlan, err := GetLastPlannedMeals(db)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// Verify the correct number of meals was returned (should be 7 days in a week)
		if len(mealPlan) != 7 {
			t.Errorf("expected meal plan for 7 days, got %d", len(mealPlan))
		}

		// Check specific days in the meal plan
		days := []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
		for _, day := range days {
			if mealPlan[day] == nil {
				t.Errorf("expected a meal for %s, got nil", day)
			}
		}

		// Check specific meal data
		if mealPlan["Monday"] != nil && (mealPlan["Monday"].ID != 1 || mealPlan["Monday"].MealName != "Monday Meal") {
			t.Errorf("unexpected meal for Monday: %+v", mealPlan["Monday"])
		}

		// Friday should always be "Eating out"
		if mealPlan["Friday"] == nil || mealPlan["Friday"].MealName != "Eating out" {
			t.Errorf("expected Friday to be 'Eating out', got: %+v", mealPlan["Friday"])
		}
	})

	t.Run("not enough meals found", func(t *testing.T) {
		// Setup expected query with fewer than 7 meals
		rows := sqlmock.NewRows([]string{"id", "meal_name", "relative_effort", "last_planned", "red_meat", "url"})
		rows.AddRow(1, "Monday Meal", 2, time.Now(), false, "https://example.com/monday")
		rows.AddRow(2, "Tuesday Meal", 3, time.Now().AddDate(0, 0, -1), false, "https://example.com/tuesday")

		queryRegex := regexp.QuoteMeta(`
			SELECT id, meal_name, relative_effort, last_planned, red_meat, url
			FROM meals
			WHERE last_planned IS NOT NULL
			ORDER BY last_planned DESC
			LIMIT 7
		`)

		mock.ExpectQuery(queryRegex).WillReturnRows(rows)

		// Call the function
		_, err := GetLastPlannedMeals(db)

		// Function should return an error because fewer than 6 meals were found
		if err == nil {
			t.Error("expected an error due to insufficient meals, got nil")
		}
	})

	t.Run("no last planned meals", func(t *testing.T) {
		// Setup expected query with no rows
		rows := sqlmock.NewRows([]string{"id", "meal_name", "relative_effort", "last_planned", "red_meat", "url"})

		queryRegex := regexp.QuoteMeta(`
			SELECT id, meal_name, relative_effort, last_planned, red_meat, url
			FROM meals
			WHERE last_planned IS NOT NULL
			ORDER BY last_planned DESC
			LIMIT 7
		`)

		mock.ExpectQuery(queryRegex).WillReturnRows(rows)

		// Call the function
		_, err := GetLastPlannedMeals(db)

		// Function should return an error because no meals were found
		if err == nil {
			t.Error("expected an error due to no meals, got nil")
		}
	})

	t.Run("database error", func(t *testing.T) {
		queryRegex := regexp.QuoteMeta(`
			SELECT id, meal_name, relative_effort, last_planned, red_meat, url
			FROM meals
			WHERE last_planned IS NOT NULL
			ORDER BY last_planned DESC
			LIMIT 7
		`)

		mock.ExpectQuery(queryRegex).WillReturnError(sql.ErrConnDone)

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
