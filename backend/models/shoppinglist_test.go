package models

import (
	"reflect"
	"testing"
)

func TestGenerateShoppingListFromMeals(t *testing.T) {
	// Construct a fake meal plan map.
	plan := map[string]*Meal{
		"Monday": {
			Id: 1, Name: "Meal A", Ingredients: []*Ingredient{
				{Name: "Eggs", Quantity: 1, Unit: "dozen"},
				{Name: "Milk", Quantity: 1, Unit: "gallon"},
				{Name: "Bread", Quantity: 1, Unit: "loaf"},
			},
		},
		"Tuesday": {
			Id: 2, Name: "Meal B", Ingredients: []*Ingredient{
				{Name: "Bread", Quantity: 1, Unit: "loaf"},
			},
		},
		"Wednesday": {
			Id: 3, Name: "Meal C", Ingredients: []*Ingredient{
				{Name: "Milk", Quantity: 1, Unit: "gallon"},
				{Name: "Coffee", Quantity: 1, Unit: "cup"},
			},
		},
		"Thursday": {
			Id: 4, Name: "Meal D", Ingredients: []*Ingredient{
				{Name: "Eggs", Quantity: 1, Unit: "dozen"},
				{Name: "Butter", Quantity: 1, Unit: "cup"},
				{Name: "Jam", Quantity: 1, Unit: "jar"},
			},
		},
		"Friday": {
			Id: 5, Name: "Eating out", Ingredients: []*Ingredient{}, // Eating out has no ingredients.
		},
		"Saturday": {
			Id: 6, Name: "Meal E", Ingredients: []*Ingredient{
				{Name: "Cheese", Quantity: 1, Unit: "block"},
				{Name: "Bread", Quantity: 1, Unit: "loaf"},
			},
		},
		"Sunday": {
			Id: 7, Name: "Meal F", Ingredients: []*Ingredient{
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

	// Expected aggregated ingredients.
	expected := []*Ingredient{
		{Name: "Bread", Quantity: 3, Unit: "loaf"},
		{Name: "Butter", Quantity: 1, Unit: "cup"},
		{Name: "Cheese", Quantity: 1, Unit: "block"},
		{Name: "Coffee", Quantity: 2, Unit: "cup"},
		{Name: "Eggs", Quantity: 3, Unit: "dozen"},
		{Name: "Jam", Quantity: 1, Unit: "jar"},
		{Name: "Milk", Quantity: 2, Unit: "gallon"},
	}

	actual := GenerateShoppingListFromMeals(meals)
	if !reflect.DeepEqual(actual, expected) {
		t.Errorf("expected shopping list %v, got %v", expected, actual)
	}
}

func TestConvertIngredientsToShoppingItems(t *testing.T) {
	ingredients := []*Ingredient{
		{Name: "Sugar", Quantity: 1, Unit: "cup"},
		{Name: "Flour", Quantity: 2.5, Unit: "cups"},
		{Name: "Eggs", Quantity: 0, Unit: ""},
	}

	items := ConvertIngredientsToShoppingItems(ingredients)
	if len(items) != 3 {
		t.Fatalf("expected 3 items got %d", len(items))
	}
	if items[0].Ingredient != "Sugar" || items[0].Quantity != "1 cup" {
		t.Errorf("unexpected first item %#v", items[0])
	}
	if items[1].Quantity != "2.5 cups" {
		t.Errorf("unexpected quantity %s", items[1].Quantity)
	}
	if items[2].Quantity != "0" {
		t.Errorf("unexpected quantity for eggs: %s", items[2].Quantity)
	}
}
