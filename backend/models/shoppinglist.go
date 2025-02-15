package models

import (
	"sort"
)

// GenerateShoppingListFromMeals aggregates the ingredients needed for the given meals.
// It returns a sorted slice of unique ingredient names.
func GenerateShoppingListFromMeals(meals []*Meal) []string {
	ingredientSet := make(map[string]struct{})
	for _, meal := range meals {
		for _, ingredient := range meal.Ingredients {
			ingredientSet[ingredient.Name] = struct{}{}
		}
	}

	ingredients := make([]string, 0, len(ingredientSet))
	for ingredient := range ingredientSet {
		ingredients = append(ingredients, ingredient)
	}
	sort.Strings(ingredients)
	return ingredients
}
