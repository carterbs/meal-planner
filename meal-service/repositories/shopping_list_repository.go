package repositories

import (
	"context"
	"database/sql"

	"mealplanner/models"
)

// ShoppingListRepositoryImpl implements ShoppingListRepository using the existing models layer
type ShoppingListRepositoryImpl struct {
	db *sql.DB
}

// NewShoppingListRepository creates a new ShoppingListRepositoryImpl
func NewShoppingListRepository(db *sql.DB) *ShoppingListRepositoryImpl {
	return &ShoppingListRepositoryImpl{db: db}
}

// GenerateShoppingListFromMeals generates a shopping list from meals
func (r *ShoppingListRepositoryImpl) GenerateShoppingListFromMeals(ctx context.Context, meals []*models.Meal) ([]*models.ShoppingListItem, error) {
	ingredients := models.GenerateShoppingListFromMeals(meals)
	return models.ConvertIngredientsToShoppingItems(ingredients), nil
}

// ConvertIngredientsToShoppingItems converts ingredients to shopping list items
func (r *ShoppingListRepositoryImpl) ConvertIngredientsToShoppingItems(ctx context.Context, ingredients []*models.Ingredient) ([]*models.ShoppingListItem, error) {
	return models.ConvertIngredientsToShoppingItems(ingredients), nil
}
