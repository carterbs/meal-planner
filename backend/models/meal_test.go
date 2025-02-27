package models

import (
	"database/sql"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

// testMeal represents a test meal with its expected properties
type testMeal struct {
	ID          int
	Name        string
	Effort      int
	LastPlanned *time.Time
	RedMeat     bool
	Ingredients []testIngredient
}

// testIngredient represents a test ingredient with its expected properties
type testIngredient struct {
	ID       int
	Name     string
	Quantity interface{} // Use interface{} to handle both nil and float64
	Unit     string
}

// setupTestDB creates a new mock database for testing
func setupTestDB(t *testing.T) (*sql.DB, sqlmock.Sqlmock) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	return db, mock
}

// setupMealRows creates mock rows for meal queries
func setupMealRows(meals []testMeal) *sqlmock.Rows {
	rows := sqlmock.NewRows([]string{
		"id", "meal_name", "relative_effort", "last_planned", "red_meat",
		"ingredient_id", "name", "quantity", "unit",
	})

	for _, meal := range meals {
		// If meal has no ingredients, add a row with null ingredient values
		if len(meal.Ingredients) == 0 {
			rows.AddRow(meal.ID, meal.Name, meal.Effort, meal.LastPlanned, meal.RedMeat,
				nil, nil, nil, nil)
			continue
		}

		// Add a row for each ingredient
		for _, ing := range meal.Ingredients {
			rows.AddRow(
				meal.ID, meal.Name, meal.Effort, meal.LastPlanned, meal.RedMeat,
				ing.ID, ing.Name, ing.Quantity, ing.Unit)
		}
	}

	return rows
}

// assertMealEquals verifies that a meal matches expected values
func assertMealEquals(t *testing.T, expected testMeal, actual *Meal) {
	t.Helper()
	
	if actual.ID != expected.ID {
		t.Errorf("expected meal ID %d, got %d", expected.ID, actual.ID)
	}
	if actual.MealName != expected.Name {
		t.Errorf("expected meal name %q, got %q", expected.Name, actual.MealName)
	}
	if actual.RelativeEffort != expected.Effort {
		t.Errorf("expected relative effort %d, got %d", expected.Effort, actual.RelativeEffort)
	}
	if actual.RedMeat != expected.RedMeat {
		t.Errorf("expected red meat %t, got %t", expected.RedMeat, actual.RedMeat)
	}

	if len(actual.Ingredients) != len(expected.Ingredients) {
		t.Fatalf("expected %d ingredients, got %d", len(expected.Ingredients), len(actual.Ingredients))
		return
	}

	// Check each ingredient
	for _, expectedIng := range expected.Ingredients {
		// Find the actual ingredient by name
		var found bool
		for _, actualIng := range actual.Ingredients {
			if actualIng.Name == expectedIng.Name {
				found = true
				if expectedIng.ID > 0 && actualIng.ID != expectedIng.ID {
					t.Errorf("ingredient %s: expected ID %d, got %d", expectedIng.Name, expectedIng.ID, actualIng.ID)
				}
				
				// For quantity, handle nil cases
				if expectedIng.Quantity == nil && actualIng.Quantity != 0 {
					t.Errorf("ingredient %s: expected quantity 0 (nil), got %v", expectedIng.Name, actualIng.Quantity)
				} else if expectedIng.Quantity != nil {
					if qty, ok := expectedIng.Quantity.(float64); ok {
						if actualIng.Quantity != qty {
							t.Errorf("ingredient %s: expected quantity %v, got %v", expectedIng.Name, qty, actualIng.Quantity)
						}
					}
				}
				
				if actualIng.Unit != expectedIng.Unit {
					t.Errorf("ingredient %s: expected unit %q, got %q", expectedIng.Name, expectedIng.Unit, actualIng.Unit)
				}
				break
			}
		}
		if !found {
			t.Errorf("ingredient %s not found in meal", expectedIng.Name)
		}
	}
}

// findMealByID finds a meal by its ID in a slice of meals
func findMealByID(meals []*Meal, id int) *Meal {
	for _, m := range meals {
		if m.ID == id {
			return m
		}
	}
	return nil
}

func TestGetMealsByIDs(t *testing.T) {
	// Create a new sqlmock database connection
	db, mock := setupTestDB(t)
	defer db.Close()

	// In tests we use the shared query
	expectedQuery := GetMealsByIDsQuery

	// Setup test data
	now := time.Now()
	testMeals := []testMeal{
		{
			ID:          1,
			Name:        "Meal A",
			Effort:      2,
			LastPlanned: nil,
			RedMeat:     false,
			Ingredients: []testIngredient{
				{ID: 1, Name: "Eggs", Quantity: nil, Unit: "dozen"},
			},
		},
		{
			ID:          2,
			Name:        "Meal B",
			Effort:      3,
			LastPlanned: &now,
			RedMeat:     true,
			Ingredients: []testIngredient{
				{ID: 2, Name: "Milk", Quantity: 2.5, Unit: "gallon"},
				{ID: 3, Name: "Bread", Quantity: nil, Unit: "loaf"},
			},
		},
	}

	// Setup mock rows and expectations
	rows := setupMealRows(testMeals)
	mock.ExpectQuery(regexp.QuoteMeta(expectedQuery)).
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(rows)

	// Call GetMealsByIDs with meal IDs 1 and 2
	meals, err := GetMealsByIDs(db, []int{1, 2})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(meals) != 2 {
		t.Fatalf("expected 2 meals, got %d", len(meals))
	}

	// Verify each meal
	mealA := findMealByID(meals, 1)
	mealB := findMealByID(meals, 2)

	if mealA == nil {
		t.Fatal("meal A not found")
	}
	if mealB == nil {
		t.Fatal("meal B not found")
	}

	// Verify meal properties
	assertMealEquals(t, testMeals[0], mealA)
	assertMealEquals(t, testMeals[1], mealB)
}

// TestGetAllMeals tests the GetAllMeals function to ensure it retrieves all meals with their ingredients.
func TestGetAllMeals(t *testing.T) {
	// Create a new sqlmock database connection
	db, mock := setupTestDB(t)
	defer db.Close()

	// Setup test data
	now := time.Now()
	testMeals := []testMeal{
		{
			ID:          1,
			Name:        "Meal A",
			Effort:      2,
			LastPlanned: nil,
			RedMeat:     false,
			Ingredients: []testIngredient{
				{ID: 1, Name: "Eggs", Quantity: nil, Unit: "dozen"},
			},
		},
		{
			ID:          2,
			Name:        "Meal B",
			Effort:      3,
			LastPlanned: &now,
			RedMeat:     true,
			Ingredients: []testIngredient{
				{ID: 2, Name: "Milk", Quantity: 2.5, Unit: "gallon"},
				{ID: 3, Name: "Bread", Quantity: nil, Unit: "loaf"},
			},
		},
	}

	// Setup mock rows and expectations
	rows := setupMealRows(testMeals)
	mock.ExpectQuery(regexp.QuoteMeta(GetAllMealsQuery)).WillReturnRows(rows)

	// Call GetAllMeals from the model
	meals, err := GetAllMeals(db)
	if err != nil {
		t.Fatalf("unexpected error calling GetAllMeals: %v", err)
	}

	// Verify that we got exactly 2 meals
	if len(meals) != 2 {
		t.Fatalf("expected 2 meals, got %d", len(meals))
	}

	// Verify each meal
	mealA := findMealByID(meals, 1)
	mealB := findMealByID(meals, 2)

	if mealA == nil {
		t.Fatal("meal A not found")
	}
	if mealB == nil {
		t.Fatal("meal B not found")
	}

	// Verify meal properties
	assertMealEquals(t, testMeals[0], mealA)
	assertMealEquals(t, testMeals[1], mealB)
}

// setupTransactionExpectations sets up the mock transaction expectations for meal operations
func setupTransactionExpectations(mock sqlmock.Sqlmock, success bool) {
	mock.ExpectBegin()
	if !success {
		mock.ExpectRollback()
	} else {
		mock.ExpectCommit()
	}
}

// setupMealInsertExpectations sets up the mock expectations for inserting a meal
func setupMealInsertExpectations(mock sqlmock.Sqlmock, meal Meal, expectedID int, ingredientIDs []int, expectError bool) {
	// Expect meal insert with QueryRow
	mealQuery := mock.ExpectQuery("INSERT INTO meals \\(meal_name, relative_effort, red_meat\\) VALUES \\(\\$1, \\$2, \\$3\\) RETURNING id").
		WithArgs(meal.MealName, meal.RelativeEffort, meal.RedMeat)
	
	if expectError {
		mealQuery.WillReturnError(sql.ErrConnDone)
		return
	}
	
	mealQuery.WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(expectedID))
	
	// Expect ingredient inserts
	for i, ing := range meal.Ingredients {
		mock.ExpectQuery("INSERT INTO ingredients \\(meal_id, quantity, unit, name\\) VALUES \\(\\$1, \\$2, \\$3, \\$4\\) RETURNING id").
			WithArgs(expectedID, ing.Quantity, ing.Unit, ing.Name).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(ingredientIDs[i]))
	}
}

func TestCreateMeal(t *testing.T) {
	// Create a new mock database connection
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	// Test meal to create
	meal := Meal{
		MealName:       "Test Meal",
		RelativeEffort: 3,
		RedMeat:        false,
		Ingredients: []Ingredient{
			{Name: "Ingredient 1", Quantity: 1.5, Unit: "cup"},
			{Name: "Ingredient 2", Quantity: 2, Unit: "tbsp"},
		},
	}

	// Expected IDs to be returned
	expectedMealID := 10
	expectedIngIDs := []int{100, 101}

	// Set up mock expectations for transaction
	mock.ExpectBegin()

	// Set up mock expectations for inserting meal
	mealRows := sqlmock.NewRows([]string{"id"}).AddRow(expectedMealID)
	mock.ExpectQuery("INSERT INTO meals").
		WithArgs(meal.MealName, meal.RelativeEffort, meal.RedMeat).
		WillReturnRows(mealRows)

	// Set up mock expectations for inserting ingredients
	for i, ing := range meal.Ingredients {
		ingRows := sqlmock.NewRows([]string{"id"}).AddRow(expectedIngIDs[i])
		mock.ExpectQuery("INSERT INTO ingredients").
			WithArgs(expectedMealID, ing.Quantity, ing.Unit, ing.Name).
			WillReturnRows(ingRows)
	}

	// Expect transaction to commit
	mock.ExpectCommit()

	// Call the function being tested
	createdMeal, err := CreateMeal(db, meal)
	if err != nil {
		t.Fatalf("Error creating meal: %v", err)
	}

	// Verify meal data
	if createdMeal.ID != expectedMealID {
		t.Errorf("Expected meal ID %d, got %d", expectedMealID, createdMeal.ID)
	}
	if createdMeal.MealName != meal.MealName {
		t.Errorf("Expected meal name %q, got %q", meal.MealName, createdMeal.MealName)
	}
	if createdMeal.RelativeEffort != meal.RelativeEffort {
		t.Errorf("Expected effort %d, got %d", meal.RelativeEffort, createdMeal.RelativeEffort)
	}
	if createdMeal.RedMeat != meal.RedMeat {
		t.Errorf("Expected red meat %t, got %t", meal.RedMeat, createdMeal.RedMeat)
	}
	
	// Verify ingredients
	if len(createdMeal.Ingredients) != len(meal.Ingredients) {
		t.Fatalf("Expected %d ingredients, got %d", len(meal.Ingredients), len(createdMeal.Ingredients))
	}
	
	for i, ing := range createdMeal.Ingredients {
		if ing.ID != expectedIngIDs[i] {
			t.Errorf("Ingredient %d: expected ID %d, got %d", i, expectedIngIDs[i], ing.ID)
		}
		if ing.Name != meal.Ingredients[i].Name {
			t.Errorf("Ingredient %d: expected name %q, got %q", i, meal.Ingredients[i].Name, ing.Name)
		}
		if ing.Quantity != meal.Ingredients[i].Quantity {
			t.Errorf("Ingredient %d: expected quantity %v, got %v", i, meal.Ingredients[i].Quantity, ing.Quantity)
		}
		if ing.Unit != meal.Ingredients[i].Unit {
			t.Errorf("Ingredient %d: expected unit %q, got %q", i, meal.Ingredients[i].Unit, ing.Unit)
		}
	}

	// Verify that all expectations were met
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("Unfulfilled expectations: %s", err)
	}
}

func TestCreateMeal_Error(t *testing.T) {
	// Create a new mock database connection
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	// Test meal to create
	meal := Meal{
		MealName:       "Test Meal",
		RelativeEffort: 3,
		RedMeat:        false,
		Ingredients: []Ingredient{
			{Name: "Ingredient 1", Quantity: 1.5, Unit: "cup"},
		},
	}

	// Expect begin transaction
	mock.ExpectBegin()
	
	// Simulate error in meal insertion
	mock.ExpectQuery("INSERT INTO meals").
		WithArgs(meal.MealName, meal.RelativeEffort, meal.RedMeat).
		WillReturnError(sql.ErrConnDone)
	
	// Expect rollback
	mock.ExpectRollback()

	// Call the function being tested
	_, err = CreateMeal(db, meal)
	
	// Assertions
	if err == nil {
		t.Error("Expected an error, but got nil")
	}

	// Verify that all expectations were met
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("Unfulfilled expectations: %s", err)
	}
}