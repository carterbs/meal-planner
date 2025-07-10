package services

import (
	"database/sql"
	"fmt"

	"mealplanner/logging"
	"mealplanner/models"
)

type shoppingListService struct {
	db *sql.DB
}

var shoppingListServiceLogger = logging.GetGrpcLogger("shopping-list-service")

// NewShoppingListService creates a new shopping list service instance
func NewShoppingListService(db *sql.DB) ShoppingListService {
	return &shoppingListService{db: db}
}

// BuildShoppingList builds a shopping list from meal IDs
func (s *shoppingListService) BuildShoppingList(mealIDs []int) ([]models.ShoppingListItem, error) {
	if len(mealIDs) == 0 {
		shoppingListServiceLogger.Info("No meal IDs provided for shopping list")
		return []models.ShoppingListItem{}, nil
	}

	shoppingListServiceLogger.Debugw("Building shopping list for meals", "mealCount", len(mealIDs))

	// Get meals with full ingredient details
	meals, err := models.GetMealsByIDs(s.db, mealIDs)
	if err != nil {
		shoppingListServiceLogger.Errorw("Failed to get meals by IDs for shopping list", "error", err)
		return nil, fmt.Errorf("failed to get meals by IDs: %w", err)
	}

	// Generate aggregated ingredients
	ingredients := models.GenerateShoppingListFromMeals(meals)

	// Convert to shopping list items
	items := models.ConvertIngredientsToShoppingItems(ingredients)

	shoppingListServiceLogger.Debugw("Generated shopping list with unique items", "itemCount", len(items))
	return items, nil
}

// GenerateShoppingListFromMeals aggregates ingredients from meals
func (s *shoppingListService) GenerateShoppingListFromMeals(meals []*models.Meal) []*models.Ingredient {
	shoppingListServiceLogger.Debugw("Generating shopping list from meals", "mealCount", len(meals))
	ingredients := models.GenerateShoppingListFromMeals(meals)
	shoppingListServiceLogger.Debugw("Generated unique ingredients", "ingredientCount", len(ingredients))
	return ingredients
}

// ConvertIngredientsToShoppingItems converts ingredients to shopping list items
func (s *shoppingListService) ConvertIngredientsToShoppingItems(ingredients []*models.Ingredient) []models.ShoppingListItem {
	shoppingListServiceLogger.Debugw("Converting ingredients to shopping list items", "ingredientCount", len(ingredients))
	items := models.ConvertIngredientsToShoppingItems(ingredients)
	shoppingListServiceLogger.Debugw("Converted to shopping list items", "itemCount", len(items))
	return items
}
