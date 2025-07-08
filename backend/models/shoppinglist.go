package models

import (
	"fmt"
	"sort"
	"strings"

	apipb "mealplanner/generated/go"
)

// ShoppingListItem aliases the protobuf message
type ShoppingListItem = apipb.ShoppingListItem

// GenerateShoppingListFromMeals aggregates the ingredients needed for the given meals.
// It returns a sorted slice of unique ingredients with aggregated quantities.
func GenerateShoppingListFromMeals(meals []*Meal) []*Ingredient {
	aggregated := make(map[string]*Ingredient)
	for _, meal := range meals {
		for _, ing := range meal.GetIngredients() {
			// Aggregate ingredients by summing their quantity.
			if existing, ok := aggregated[ing.GetName()]; ok {
				existing.Quantity += ing.GetQuantity()
				aggregated[ing.GetName()] = existing
			} else {
				// Create a copy for aggregation
				newIng := &Ingredient{
					Id:       ing.GetId(),
					MealId:   ing.GetMealId(),
					Quantity: ing.GetQuantity(),
					Unit:     ing.GetUnit(),
					Name:     ing.GetName(),
				}
				aggregated[ing.GetName()] = newIng
			}
		}
	}

	ingredients := make([]*Ingredient, 0, len(aggregated))
	for _, ing := range aggregated {
		ingredients = append(ingredients, ing)
	}

	// Sort the slice by ingredient name.
	sort.Slice(ingredients, func(i, j int) bool {
		return ingredients[i].Name < ingredients[j].Name
	})
	return ingredients
}

// ConvertIngredients converts a slice of Ingredient into ShoppingListItem entries.
func ConvertIngredientsToShoppingItems(ings []*Ingredient) []ShoppingListItem {
	items := make([]ShoppingListItem, 0, len(ings))
	for _, ing := range ings {
		qty := strings.TrimSpace(fmt.Sprintf("%v %s", ing.GetQuantity(), ing.GetUnit()))
		items = append(items, ShoppingListItem{
			Ingredient: ing.GetName(),
			Quantity:   strings.TrimSpace(qty),
		})
	}
	return items
}
