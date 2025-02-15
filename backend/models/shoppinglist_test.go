package models

import (
	"reflect"
	"testing"
)

func TestGenerateShoppingListFromMeals(t *testing.T) {
	// Construct a fake meal plan map.
	plan := map[string]*Meal{
		"Monday": {
			ID: 1, MealName: "Meal A", Ingredients: []Ingredient{
				{Name: "Eggs", Quantity: 1, Unit: "dozen"},
				{Name: "Milk", Quantity: 1, Unit: "gallon"},
				{Name: "Bread", Quantity: 1, Unit: "loaf"},
			},
		},
		"Tuesday": {
			ID: 2, MealName: "Meal B", Ingredients: []Ingredient{
				{Name: "Bread", Quantity: 1, Unit: "loaf"},
			},
		},
		"Wednesday": {
			ID: 3, MealName: "Meal C", Ingredients: []Ingredient{
				{Name: "Milk", Quantity: 1, Unit: "gallon"},
				{Name: "Coffee", Quantity: 1, Unit: "cup"},
			},
		},
		"Thursday": {
			ID: 4, MealName: "Meal D", Ingredients: []Ingredient{
				{Name: "Eggs", Quantity: 1, Unit: "dozen"},
				{Name: "Butter", Quantity: 1, Unit: "cup"},
				{Name: "Jam", Quantity: 1, Unit: "jar"},
			},
		},
		"Friday": {
			ID: 5, MealName: "Eating out", Ingredients: []Ingredient{}, // Eating out has no ingredients.
		},
		"Saturday": {
			ID: 6, MealName: "Meal E", Ingredients: []Ingredient{
				{Name: "Cheese", Quantity: 1, Unit: "block"},
				{Name: "Bread", Quantity: 1, Unit: "loaf"},
			},
		},
		"Sunday": {
			ID: 7, MealName: "Meal F", Ingredients: []Ingredient{
				{Name: "Coffee", Quantity: 1, Unit: "cup"},
				{Name: "Eggs", Quantity: 1, Unit: "dozen"},
			},
		},
	}

	// Convert the map into a slice of meals.
	meals := []*Meal{}
	for _, meal := range plan {
		meals = append(meals, meal)
	}

	// Expected aggregated list is unique and sorted.
	expected := []string{"Bread", "Butter", "Cheese", "Coffee", "Eggs", "Jam", "Milk"}

	list := GenerateShoppingListFromMeals(meals)
	if !reflect.DeepEqual(list, expected) {
		t.Errorf("expected shopping list %v, got %v", expected, list)
	}
}
