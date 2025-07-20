package testutil

import (
	"context"
	"errors"
	"time"

	"mealplanner/models"
)

// Common test contexts
var (
	TestContext = context.Background()
	TestTimeout = 5 * time.Second
)

// Common test errors
var (
	ErrTestDatabase   = errors.New("test database error")
	ErrTestNotFound   = errors.New("test record not found")
	ErrTestValidation = errors.New("test validation error")
)

// Common test data constants
const (
	TestMealID1 = 1
	TestMealID2 = 2
	TestMealID3 = 3

	TestIngredientID1 = 1
	TestIngredientID2 = 2
	TestIngredientID3 = 3

	TestStepID1 = 1
	TestStepID2 = 2
	TestStepID3 = 3

	TestThreadID     = "test-thread-123"
	TestNamespace    = "test-namespace"
	TestWorkflowType = "meal-planning"
)

// Common test meal types
const (
	MealTypeBreakfast = "breakfast"
	MealTypeLunch     = "lunch"
	MealTypeDinner    = "dinner"
)

// Common test units
const (
	UnitCup        = "cup"
	UnitTablespoon = "tbsp"
	UnitTeaspoon   = "tsp"
	UnitPound      = "lb"
	UnitOunce      = "oz"
	UnitWhole      = "whole"
)

// CreateTestMealSet creates a set of test meals for different scenarios
func CreateTestMealSet() []*models.Meal {
	return []*models.Meal{
		NewMealBuilder().
			WithID(TestMealID1).
			WithName("Spaghetti Carbonara").
			WithMealType(MealTypeDinner).
			WithEffort(3).
			WithIngredients([]*models.Ingredient{
				NewIngredientBuilder().WithID(1).WithName("Spaghetti").WithQuantity(1.0).WithUnit(UnitPound).WithMealID(TestMealID1).Build(),
				NewIngredientBuilder().WithID(2).WithName("Eggs").WithQuantity(4.0).WithUnit(UnitWhole).WithMealID(TestMealID1).Build(),
				NewIngredientBuilder().WithID(3).WithName("Parmesan").WithQuantity(0.5).WithUnit(UnitCup).WithMealID(TestMealID1).Build(),
			}).
			WithSteps([]*models.Step{
				NewStepBuilder().WithID(1).WithMealID(TestMealID1).WithOrder(1).WithInstruction("Boil water and cook spaghetti").Build(),
				NewStepBuilder().WithID(2).WithMealID(TestMealID1).WithOrder(2).WithInstruction("Mix eggs and cheese").Build(),
				NewStepBuilder().WithID(3).WithMealID(TestMealID1).WithOrder(3).WithInstruction("Combine pasta with egg mixture").Build(),
			}).
			Build(),

		NewMealBuilder().
			WithID(TestMealID2).
			WithName("Chicken Tacos").
			WithMealType(MealTypeDinner).
			WithEffort(2).
			WithIngredients([]*models.Ingredient{
				NewIngredientBuilder().WithID(4).WithName("Chicken Breast").WithQuantity(1.0).WithUnit(UnitPound).WithMealID(TestMealID2).Build(),
				NewIngredientBuilder().WithID(5).WithName("Tortillas").WithQuantity(8.0).WithUnit(UnitWhole).WithMealID(TestMealID2).Build(),
				NewIngredientBuilder().WithID(6).WithName("Lime").WithQuantity(2.0).WithUnit(UnitWhole).WithMealID(TestMealID2).Build(),
			}).
			WithSteps([]*models.Step{
				NewStepBuilder().WithID(4).WithMealID(TestMealID2).WithOrder(1).WithInstruction("Season and cook chicken").Build(),
				NewStepBuilder().WithID(5).WithMealID(TestMealID2).WithOrder(2).WithInstruction("Warm tortillas").Build(),
				NewStepBuilder().WithID(6).WithMealID(TestMealID2).WithOrder(3).WithInstruction("Assemble tacos").Build(),
			}).
			Build(),

		NewMealBuilder().
			WithID(TestMealID3).
			WithName("Scrambled Eggs").
			WithMealType(MealTypeBreakfast).
			WithEffort(1).
			WithIngredients([]*models.Ingredient{
				NewIngredientBuilder().WithID(7).WithName("Eggs").WithQuantity(3.0).WithUnit(UnitWhole).WithMealID(TestMealID3).Build(),
				NewIngredientBuilder().WithID(8).WithName("Butter").WithQuantity(1.0).WithUnit(UnitTablespoon).WithMealID(TestMealID3).Build(),
				NewIngredientBuilder().WithID(9).WithName("Salt").WithQuantity(0.25).WithUnit(UnitTeaspoon).WithMealID(TestMealID3).Build(),
			}).
			WithSteps([]*models.Step{
				NewStepBuilder().WithID(7).WithMealID(TestMealID3).WithOrder(1).WithInstruction("Crack eggs into bowl").Build(),
				NewStepBuilder().WithID(8).WithMealID(TestMealID3).WithOrder(2).WithInstruction("Heat butter in pan").Build(),
				NewStepBuilder().WithID(9).WithMealID(TestMealID3).WithOrder(3).WithInstruction("Scramble eggs").Build(),
			}).
			Build(),
	}
}

// CreateTestWeeklyMealPlan creates a test weekly meal plan
func CreateTestWeeklyMealPlan() *models.WeeklyMealPlan {
	meals := CreateTestMealSet()
	return NewWeeklyMealPlanBuilder().
		WithBreakfast(0, meals[2]). // Monday breakfast
		WithDinner(0, meals[0]).    // Monday dinner
		WithDinner(1, meals[1]).    // Tuesday dinner
		Build()
}

// CreateTestShoppingList creates a test shopping list
func CreateTestShoppingList() []*models.ShoppingListItem {
	return []*models.ShoppingListItem{
		NewShoppingListItemBuilder().WithIngredient("Chicken Breast").WithQuantity("1.0 lb").Build(),
		NewShoppingListItemBuilder().WithIngredient("Eggs").WithQuantity("7 whole").Build(),
		NewShoppingListItemBuilder().WithIngredient("Parmesan").WithQuantity("0.5 cup").Build(),
		NewShoppingListItemBuilder().WithIngredient("Spaghetti").WithQuantity("1.0 lb").Build(),
		NewShoppingListItemBuilder().WithIngredient("Tortillas").WithQuantity("8 whole").Build(),
	}
}

// CreateTestLastPlannedMeals creates test last planned meals data
func CreateTestLastPlannedMeals() *models.LastPlannedMeals {
	return &models.LastPlannedMeals{
		BreakfastMeals: []*models.Meal{},
		LunchMeals:     []*models.Meal{},
		DinnerMeals:    []*models.Meal{},
	}
}

// GetTestMealIDs returns a slice of test meal IDs
func GetTestMealIDs() []int {
	return []int{TestMealID1, TestMealID2, TestMealID3}
}

// GetTestIngredientIDs returns a slice of test ingredient IDs
func GetTestIngredientIDs() []int {
	return []int{TestIngredientID1, TestIngredientID2, TestIngredientID3}
}

// GetTestStepIDs returns a slice of test step IDs
func GetTestStepIDs() []int {
	return []int{TestStepID1, TestStepID2, TestStepID3}
}

// GetTestInstructions returns a slice of test instructions
func GetTestInstructions() []string {
	return []string{
		"First test instruction",
		"Second test instruction",
		"Third test instruction",
	}
}
