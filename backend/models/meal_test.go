package models

import (
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestGetMealsByIDs(t *testing.T) {
	// Create a new sqlmock database connection.
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to open sqlmock: %v", err)
	}
	defer db.Close()

	// In tests we use the shared query.
	expectedQuery := GetMealsByIDsQuery

	// Setup rows for two meals:
	// Meal A: one ingredient ("Eggs") with an empty quantity simulated as NULL.
	// Meal B: two rows. One for "Milk" with a valid quantity and one for "Bread" with an empty quantity.
	now := time.Now()
	rows := sqlmock.NewRows([]string{
		"id", "meal_name", "relative_effort", "last_planned", "red_meat", "name", "quantity", "unit",
	}).
		AddRow(1, "Meal A", 2, nil, false, "Eggs", nil, "dozen").
		AddRow(2, "Meal B", 3, now, true, "Milk", 2.5, "gallon").
		AddRow(2, "Meal B", 3, now, true, "Bread", nil, "loaf")

	mock.ExpectQuery(regexp.QuoteMeta(expectedQuery)).WithArgs(sqlmock.AnyArg()).WillReturnRows(rows)

	// Call GetMealsByIDs with meal IDs 1 and 2.
	meals, err := GetMealsByIDs(db, []int{1, 2})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(meals) != 2 {
		t.Fatalf("expected 2 meals, got %d", len(meals))
	}

	// Group meals by ID for easier assertions.
	var mealA, mealB *Meal
	for _, m := range meals {
		switch m.ID {
		case 1:
			mealA = m
		case 2:
			mealB = m
		}
	}
	if mealA == nil {
		t.Fatal("meal A not found")
	}
	if mealB == nil {
		t.Fatal("meal B not found")
	}

	// For meal A, verify that the ingredient "Eggs" has Quantity 0 (since empty string was converted to NULL).
	if len(mealA.Ingredients) != 1 {
		t.Fatalf("expected 1 ingredient for meal A, got %d", len(mealA.Ingredients))
	}
	ingA := mealA.Ingredients[0]
	if ingA.Name != "Eggs" || ingA.Quantity != 0 || ingA.Unit != "dozen" {
		t.Errorf("unexpected ingredient for meal A: %+v", ingA)
	}

	// For meal B, verify there are 2 ingredients.
	if len(mealB.Ingredients) != 2 {
		t.Fatalf("expected 2 ingredients for meal B, got %d", len(mealB.Ingredients))
	}
	var foundMilk, foundBread bool
	for _, ing := range mealB.Ingredients {
		if ing.Name == "Milk" {
			foundMilk = true
			if ing.Quantity != 2.5 || ing.Unit != "gallon" {
				t.Errorf("expected Milk quantity 2.5 and unit 'gallon'; got %v, %v", ing.Quantity, ing.Unit)
			}
		} else if ing.Name == "Bread" {
			foundBread = true
			if ing.Quantity != 0 || ing.Unit != "loaf" {
				t.Errorf("expected Bread quantity 0 and unit 'loaf'; got %v, %v", ing.Quantity, ing.Unit)
			}
		}
	}
	if !foundMilk || !foundBread {
		t.Errorf("expected both Milk and Bread ingredients; got %+v", mealB.Ingredients)
	}
}

// TestGetAllMeals tests the GetAllMeals function to ensure it retrieves all meals with their ingredients.
func TestGetAllMeals(t *testing.T) {
	// Create a new sqlmock database connection.
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	// Setup rows for two meals:
	// Meal A: one ingredient ("Eggs") with an empty quantity (simulated by returning nil for quantity).
	// Meal B: two rows; one for "Milk" with a valid quantity and one for "Bread" with an empty quantity.
	now := time.Now()
	rows := sqlmock.NewRows([]string{
		"id", "meal_name", "relative_effort", "last_planned", "red_meat", "name", "quantity", "unit",
	}).
		AddRow(1, "Meal A", 2, nil, false, "Eggs", nil, "dozen").
		AddRow(2, "Meal B", 3, now, true, "Milk", 2.5, "gallon").
		AddRow(2, "Meal B", 3, now, true, "Bread", nil, "loaf")

	// Expect the shared query for all meals.
	mock.ExpectQuery(regexp.QuoteMeta(GetAllMealsQuery)).WillReturnRows(rows)

	// Call GetAllMeals from the model.
	meals, err := GetAllMeals(db)
	if err != nil {
		t.Fatalf("unexpected error calling GetAllMeals: %v", err)
	}

	// Verify that we got exactly 2 meals.
	if len(meals) != 2 {
		t.Errorf("expected 2 meals, got %d", len(meals))
	}

	// Group meals by ID for easier assertion.
	var mealA, mealB *Meal
	for _, m := range meals {
		switch m.ID {
		case 1:
			mealA = m
		case 2:
			mealB = m
		}
	}
	if mealA == nil {
		t.Fatal("Meal A not found")
	}
	if mealB == nil {
		t.Fatal("Meal B not found")
	}

	// For Meal A, verify that the ingredient "Eggs" is present with Quantity 0 (nil converted to 0).
	if len(mealA.Ingredients) != 1 {
		t.Errorf("expected 1 ingredient for Meal A, got %d", len(mealA.Ingredients))
	}
	if mealA.Ingredients[0].Name != "Eggs" || mealA.Ingredients[0].Quantity != 0 || mealA.Ingredients[0].Unit != "dozen" {
		t.Errorf("unexpected ingredient for Meal A: %+v", mealA.Ingredients[0])
	}

	// For Meal B, verify there are 2 ingredients.
	if len(mealB.Ingredients) != 2 {
		t.Errorf("expected 2 ingredients for Meal B, got %d", len(mealB.Ingredients))
	}
	var foundMilk, foundBread bool
	for _, ing := range mealB.Ingredients {
		if ing.Name == "Milk" {
			foundMilk = true
			if ing.Quantity != 2.5 || ing.Unit != "gallon" {
				t.Errorf("expected Milk with quantity 2.5 and unit 'gallon'; got %v, %v", ing.Quantity, ing.Unit)
			}
		} else if ing.Name == "Bread" {
			foundBread = true
			if ing.Quantity != 0 || ing.Unit != "loaf" {
				t.Errorf("expected Bread with quantity 0 and unit 'loaf'; got %v, %v", ing.Quantity, ing.Unit)
			}
		}
	}
	if !foundMilk || !foundBread {
		t.Errorf("expected both Milk and Bread ingredients; got %+v", mealB.Ingredients)
	}
}
