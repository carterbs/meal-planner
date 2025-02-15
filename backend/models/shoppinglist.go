package models

import (
	"sort"
)

// GenerateShoppingListFromMeals aggregates the ingredients needed for the given meals.
// It returns a sorted slice of unique ingredients with aggregated quantities.
func GenerateShoppingListFromMeals(meals []*Meal) []Ingredient {
	aggregated := make(map[string]Ingredient)
	for _, meal := range meals {
		for _, ing := range meal.Ingredients {
			// Aggregate ingredients by summing their quantity.
			if existing, ok := aggregated[ing.Name]; ok {
				existing.Quantity += ing.Quantity
				aggregated[ing.Name] = existing
			} else {
				aggregated[ing.Name] = ing
			}
		}
	}

	ingredients := make([]Ingredient, 0, len(aggregated))
	for _, ing := range aggregated {
		ingredients = append(ingredients, ing)
	}

	// Sort the slice by ingredient name.
	sort.Slice(ingredients, func(i, j int) bool {
		return ingredients[i].Name < ingredients[j].Name
	})
	return ingredients
}
