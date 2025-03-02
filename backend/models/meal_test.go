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
	URL         string
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
		"id", "meal_name", "relative_effort", "last_planned", "red_meat", "url",
		"ingredient_id", "name", "quantity", "unit",
	})

	for _, meal := range meals {
		// If meal has no ingredients, add a row with null ingredient values
		if len(meal.Ingredients) == 0 {
			rows.AddRow(meal.ID, meal.Name, meal.Effort, meal.LastPlanned, meal.RedMeat, meal.URL,
				nil, nil, nil, nil)
			continue
		}

		// Add a row for each ingredient
		for _, ing := range meal.Ingredients {
			rows.AddRow(
				meal.ID, meal.Name, meal.Effort, meal.LastPlanned, meal.RedMeat, meal.URL,
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
	if actual.URL != expected.URL {
		t.Errorf("expected URL %q, got %q", expected.URL, actual.URL)
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
			URL:         "https://example.com/meala",
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
			URL:         "https://example.com/mealb",
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

	// In tests we use the shared query
	expectedQuery := GetAllMealsQuery

	// Setup test data
	now := time.Now()
	testMeals := []testMeal{
		{
			ID:          1,
			Name:        "Meal A",
			Effort:      2,
			LastPlanned: nil,
			RedMeat:     false,
			URL:         "https://example.com/meala",
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
			URL:         "https://example.com/mealb",
			Ingredients: []testIngredient{
				{ID: 2, Name: "Milk", Quantity: 2.5, Unit: "gallon"},
				{ID: 3, Name: "Bread", Quantity: nil, Unit: "loaf"},
			},
		},
	}

	// Setup mock rows and expectations
	rows := setupMealRows(testMeals)
	mock.ExpectQuery(regexp.QuoteMeta(expectedQuery)).
		WillReturnRows(rows)

	// Call GetAllMeals
	meals, err := GetAllMeals(db)
	if err != nil {
		t.Fatalf("unexpected error calling GetAllMeals: %v", err)
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

// TestSwapMeal tests the SwapMeal function to ensure it returns a different meal.
func TestSwapMeal(t *testing.T) {
	// Create a new sqlmock database connection
	db, mock := setupTestDB(t)
	defer db.Close()

	currentMealID := 1
	expectedQuery := GetRandomMealExcludingQuery

	// Setup test data
	now := time.Now()
	testMeals := []testMeal{
		{
			ID:          2,
			Name:        "Meal B",
			Effort:      3,
			LastPlanned: &now,
			RedMeat:     true,
			URL:         "https://example.com/mealb",
			Ingredients: []testIngredient{
				{ID: 2, Name: "Milk", Quantity: 2.5, Unit: "gallon"},
				{ID: 3, Name: "Bread", Quantity: nil, Unit: "loaf"},
			},
		},
	}

	// Setup mock rows and expectations
	rows := setupMealRows(testMeals)
	mock.ExpectQuery(regexp.QuoteMeta(expectedQuery)).
		WithArgs(currentMealID).
		WillReturnRows(rows)

	// Call SwapMeal
	newMeal, err := SwapMeal(currentMealID, db)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if newMeal.ID == currentMealID {
		t.Errorf("expected different meal, got same id %d", currentMealID)
	}

	// Verify properties of the returned meal
	assertMealEquals(t, testMeals[0], newMeal)
}

// TestUpdateMealIngredient tests the UpdateMealIngredient function to ensure it properly updates an ingredient.
func TestUpdateMealIngredient(t *testing.T) {
	// Create a new sqlmock database connection
	db, mock := setupTestDB(t)
	defer db.Close()

	mealID := 1
	ingredient := Ingredient{
		ID:       2,
		Name:     "Updated Milk",
		Quantity: 3.0,
		Unit:     "cup",
	}

	// Setup expectations for update query
	mock.ExpectExec("UPDATE ingredients SET").
		WithArgs(ingredient.Name, ingredient.Quantity, ingredient.Unit, ingredient.ID, mealID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Call UpdateMealIngredient
	err := UpdateMealIngredient(db, mealID, ingredient)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify all expectations were met
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %s", err)
	}
}

// TestDeleteMealIngredient tests the DeleteMealIngredient function to ensure it properly deletes an ingredient.
func TestDeleteMealIngredient(t *testing.T) {
	// Create a new sqlmock database connection
	db, mock := setupTestDB(t)
	defer db.Close()

	ingredientID := 2

	// Setup expectations for delete query
	mock.ExpectExec("DELETE FROM ingredients WHERE id = \\$1").
		WithArgs(ingredientID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Call DeleteMealIngredient
	err := DeleteMealIngredient(db, ingredientID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify all expectations were met
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %s", err)
	}
}

// TestDeleteMeal tests the DeleteMeal function to ensure it properly deletes a meal and its ingredients.
func TestDeleteMeal(t *testing.T) {
	// Create a new sqlmock database connection
	db, mock := setupTestDB(t)
	defer db.Close()

	mealID := 1

	// Setup expectations for transaction
	mock.ExpectBegin()

	// First expect recipe_steps deletion
	mock.ExpectExec("DELETE FROM recipe_steps WHERE meal_id = \\$1").
		WithArgs(mealID).
		WillReturnResult(sqlmock.NewResult(0, 2))

	// Next expect ingredients deletion
	mock.ExpectExec("DELETE FROM ingredients WHERE meal_id = \\$1").
		WithArgs(mealID).
		WillReturnResult(sqlmock.NewResult(0, 2))

	// Finally expect meal deletion
	mock.ExpectExec("DELETE FROM meals WHERE id = \\$1").
		WithArgs(mealID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Expect transaction commit
	mock.ExpectCommit()

	// Call DeleteMeal
	err := DeleteMeal(db, mealID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify all expectations were met
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %s", err)
	}
}

func TestCreateMeal(t *testing.T) {
	// Create a new sqlmock database connection
	db, mock := setupTestDB(t)
	defer db.Close()

	meal := Meal{
		MealName:       "Test Meal",
		RelativeEffort: 3,
		RedMeat:        false,
		URL:            "https://example.com/testmeal",
		Ingredients: []Ingredient{
			{Name: "Test Ingredient 1", Quantity: 1.5, Unit: "cup"},
			{Name: "Test Ingredient 2", Quantity: 2, Unit: "tbsp"},
		},
	}

	// Setup expectations for transaction
	mock.ExpectBegin()

	// Expect meal insertion
	mock.ExpectQuery("INSERT INTO meals \\(meal_name, relative_effort, red_meat, url\\) VALUES").
		WithArgs(meal.MealName, meal.RelativeEffort, meal.RedMeat, meal.URL).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

	// Expect ingredient insertions
	for i := range meal.Ingredients {
		mock.ExpectQuery("INSERT INTO ingredients \\(meal_id, quantity, unit, name\\) VALUES").
			WithArgs(1, meal.Ingredients[i].Quantity, meal.Ingredients[i].Unit, meal.Ingredients[i].Name).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(i + 1))
	}

	// Expect transaction commit
	mock.ExpectCommit()

	// Call CreateMeal
	createdMeal, err := CreateMeal(db, meal)
	if err != nil {
		t.Fatalf("Error creating meal: %v", err)
	}

	// Verify created meal
	if createdMeal.ID != 1 {
		t.Errorf("expected meal ID 1, got %d", createdMeal.ID)
	}
	if createdMeal.MealName != meal.MealName {
		t.Errorf("expected meal name %q, got %q", meal.MealName, createdMeal.MealName)
	}
	if createdMeal.URL != meal.URL {
		t.Errorf("expected URL %q, got %q", meal.URL, createdMeal.URL)
	}
	if len(createdMeal.Ingredients) != len(meal.Ingredients) {
		t.Errorf("expected %d ingredients, got %d", len(meal.Ingredients), len(createdMeal.Ingredients))
	}

	// Verify all expectations were met
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %s", err)
	}
}

func TestCreateMeal_Error(t *testing.T) {
	// Create a new sqlmock database connection
	db, mock := setupTestDB(t)
	defer db.Close()

	meal := Meal{
		MealName:       "Test Meal",
		RelativeEffort: 3,
		RedMeat:        false,
		URL:            "https://example.com/testmeal",
		Ingredients: []Ingredient{
			{Name: "Test Ingredient", Quantity: 1, Unit: "cup"},
		},
	}

	// Setup expectations for transaction
	mock.ExpectBegin()

	// Expect meal insertion with error
	mock.ExpectQuery("INSERT INTO meals").
		WithArgs(meal.MealName, meal.RelativeEffort, meal.RedMeat, meal.URL).
		WillReturnError(sql.ErrConnDone)

	// Expect transaction rollback
	mock.ExpectRollback()

	// Call CreateMeal
	_, err := CreateMeal(db, meal)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	// Verify all expectations were met
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %s", err)
	}
}
