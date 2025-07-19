package testutil

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"mealplanner/models"
)

// AssertMealEquals asserts that two meals are equal
func AssertMealEquals(t *testing.T, expected, actual *models.Meal) {
	t.Helper()
	assert.Equal(t, expected.GetId(), actual.GetId(), "Meal ID mismatch")
	assert.Equal(t, expected.GetName(), actual.GetName(), "Meal name mismatch")
	assert.Equal(t, expected.GetMealType(), actual.GetMealType(), "Meal type mismatch")
	assert.Equal(t, expected.GetEffort(), actual.GetEffort(), "Effort level mismatch")
	assert.Equal(t, len(expected.GetIngredients()), len(actual.GetIngredients()), "Ingredient count mismatch")
	assert.Equal(t, len(expected.GetSteps()), len(actual.GetSteps()), "Step count mismatch")
}

// AssertIngredientEquals asserts that two ingredients are equal
func AssertIngredientEquals(t *testing.T, expected, actual *models.Ingredient) {
	t.Helper()
	assert.Equal(t, expected.GetId(), actual.GetId(), "Ingredient ID mismatch")
	assert.Equal(t, expected.GetName(), actual.GetName(), "Ingredient name mismatch")
	assert.Equal(t, expected.GetQuantity(), actual.GetQuantity(), "Ingredient quantity mismatch")
	assert.Equal(t, expected.GetUnit(), actual.GetUnit(), "Ingredient unit mismatch")
	assert.Equal(t, expected.GetMealId(), actual.GetMealId(), "Ingredient meal ID mismatch")
}

// AssertStepEquals asserts that two steps are equal
func AssertStepEquals(t *testing.T, expected, actual *models.Step) {
	t.Helper()
	assert.Equal(t, expected.GetId(), actual.GetId(), "Step ID mismatch")
	assert.Equal(t, expected.GetMealId(), actual.GetMealId(), "Step meal ID mismatch")
	assert.Equal(t, expected.GetStepNumber(), actual.GetStepNumber(), "Step order mismatch")
	assert.Equal(t, expected.GetInstruction(), actual.GetInstruction(), "Step instruction mismatch")
}

// AssertShoppingListItemEquals asserts that two shopping list items are equal
func AssertShoppingListItemEquals(t *testing.T, expected, actual *models.ShoppingListItem) {
	t.Helper()
	assert.Equal(t, expected.GetIngredient(), actual.GetIngredient(), "Shopping list item name mismatch")
	assert.Equal(t, expected.GetQuantity(), actual.GetQuantity(), "Shopping list item quantity mismatch")
	assert.Equal(t, expected.GetQuantity(), actual.GetQuantity(), "Shopping list item quantity mismatch")
}

// AssertWeeklyMealPlanEquals asserts that two weekly meal plans are equal
func AssertWeeklyMealPlanEquals(t *testing.T, expected, actual *models.WeeklyMealPlan) {
	t.Helper()
	assert.Equal(t, len(expected.GetDays()), len(actual.GetDays()), "Days count mismatch")
	
	// Check each day's meals
	for i, expectedDay := range expected.GetDays() {
		if i >= len(actual.GetDays()) {
			break
		}
		actualDay := actual.GetDays()[i]
		assert.Equal(t, expectedDay.GetDayIndex(), actualDay.GetDayIndex(), "Day index mismatch at %d", i)
		assert.Equal(t, expectedDay.GetMealType(), actualDay.GetMealType(), "Meal type mismatch at %d", i)
		if expectedDay.GetMeal() != nil && actualDay.GetMeal() != nil {
			AssertMealEquals(t, expectedDay.GetMeal(), actualDay.GetMeal())
		} else {
			assert.Equal(t, expectedDay.GetMeal(), actualDay.GetMeal(), "Meal mismatch at day %d", i)
		}
	}
}

// AssertMealSliceEquals asserts that two meal slices are equal
func AssertMealSliceEquals(t *testing.T, expected, actual []*models.Meal) {
	t.Helper()
	assert.Equal(t, len(expected), len(actual), "Meal slice length mismatch")
	for i, expectedMeal := range expected {
		AssertMealEquals(t, expectedMeal, actual[i])
	}
}

// AssertIngredientSliceEquals asserts that two ingredient slices are equal
func AssertIngredientSliceEquals(t *testing.T, expected, actual []*models.Ingredient) {
	t.Helper()
	assert.Equal(t, len(expected), len(actual), "Ingredient slice length mismatch")
	for i, expectedIngredient := range expected {
		AssertIngredientEquals(t, expectedIngredient, actual[i])
	}
}

// AssertStepSliceEquals asserts that two step slices are equal
func AssertStepSliceEquals(t *testing.T, expected, actual []*models.Step) {
	t.Helper()
	assert.Equal(t, len(expected), len(actual), "Step slice length mismatch")
	for i, expectedStep := range expected {
		AssertStepEquals(t, expectedStep, actual[i])
	}
}

// AssertShoppingListEquals asserts that two shopping lists are equal
func AssertShoppingListEquals(t *testing.T, expected, actual []*models.ShoppingListItem) {
	t.Helper()
	assert.Equal(t, len(expected), len(actual), "Shopping list length mismatch")
	for i, expectedItem := range expected {
		AssertShoppingListItemEquals(t, expectedItem, actual[i])
	}
}