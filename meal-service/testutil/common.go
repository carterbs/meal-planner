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
	// Meal 1: Spaghetti Carbonara (Dinner)
	meal1 := NewMealBuilder().
		WithID(TestMealID1).
		WithName("Spaghetti Carbonara").
		WithMealType(MealTypeDinner).
		WithEffort(3).
		WithIngredients(
			NewIngredientBuilder().WithID(TestIngredientID1).WithName("Spaghetti").WithQuantity(1).WithUnit("lb").Build(),
			NewIngredientBuilder().WithID(TestIngredientID2).WithName("Eggs").WithQuantity(3).WithUnit("large").Build(),
			NewIngredientBuilder().WithID(TestIngredientID3).WithName("Parmesan").WithQuantity(1).WithUnit("cup").Build(),
		).
		WithSteps(
			NewStepBuilder().WithID(TestStepID1).WithInstruction("Boil spaghetti").Build(),
			NewStepBuilder().WithID(TestStepID2).WithInstruction("Mix eggs and cheese").Build(),
			NewStepBuilder().WithID(TestStepID3).WithInstruction("Combine and serve").Build(),
		).
		Build()

	// Meal 2: Chicken Tacos (Dinner)
	meal2 := NewMealBuilder().
		WithID(TestMealID2).
		WithName("Chicken Tacos").
		WithMealType(MealTypeDinner).
		WithEffort(2).
		WithIngredients(
			NewIngredientBuilder().WithID(4).WithName("Chicken Breast").WithQuantity(2).WithUnit("lbs").Build(),
			NewIngredientBuilder().WithID(5).WithName("Tortillas").WithQuantity(8).WithUnit("whole").Build(),
			NewIngredientBuilder().WithID(6).WithName("Salsa").WithQuantity(1).WithUnit("cup").Build(),
		).
		WithSteps(
			NewStepBuilder().WithID(4).WithInstruction("Cook chicken").Build(),
			NewStepBuilder().WithID(5).WithInstruction("Warm tortillas").Build(),
			NewStepBuilder().WithID(6).WithInstruction("Assemble tacos").Build(),
		).
		Build()

	// Meal 3: Scrambled Eggs (Breakfast)
	meal3 := NewMealBuilder().
		WithID(TestMealID3).
		WithName("Scrambled Eggs").
		WithMealType(MealTypeBreakfast).
		WithEffort(1).
		WithIngredients(
			NewIngredientBuilder().WithID(7).WithName("Eggs").WithQuantity(3).WithUnit("large").Build(),
			NewIngredientBuilder().WithID(8).WithName("Milk").WithQuantity(2).WithUnit("tbsp").Build(),
			NewIngredientBuilder().WithID(9).WithName("Butter").WithQuantity(1).WithUnit("tbsp").Build(),
		).
		WithSteps(
			NewStepBuilder().WithID(7).WithInstruction("Whisk eggs and milk").Build(),
			NewStepBuilder().WithID(8).WithInstruction("Melt butter in pan").Build(),
			NewStepBuilder().WithID(9).WithInstruction("Scramble eggs").Build(),
		).
		Build()

	return []*models.Meal{meal1, meal2, meal3}
}
