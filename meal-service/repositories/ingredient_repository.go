package repositories

import (
	"context"
	"database/sql"

	"mealplanner/models"
)

// IngredientRepositoryImpl implements IngredientRepository using the existing models layer
type IngredientRepositoryImpl struct {
	db *sql.DB
}

// NewIngredientRepository creates a new IngredientRepositoryImpl
func NewIngredientRepository(db *sql.DB) *IngredientRepositoryImpl {
	return &IngredientRepositoryImpl{db: db}
}

// UpdateMealIngredient updates a meal's ingredient
func (r *IngredientRepositoryImpl) UpdateMealIngredient(ctx context.Context, mealID int, ingredient *models.Ingredient) error {
	return models.UpdateMealIngredient(r.db, mealID, ingredient)
}

// DeleteMealIngredient deletes a meal's ingredient
func (r *IngredientRepositoryImpl) DeleteMealIngredient(ctx context.Context, ingredientID int) error {
	return models.DeleteMealIngredient(r.db, ingredientID)
}

// GetIngredientsForMeals retrieves ingredients for multiple meals (used for shopping lists)
func (r *IngredientRepositoryImpl) GetIngredientsForMeals(ctx context.Context, mealIDs []int) ([]*models.Ingredient, error) {
	// This is handled by GetMealsByIDs in the models layer
	meals, err := models.GetMealsByIDs(r.db, mealIDs)
	if err != nil {
		return nil, err
	}
	
	var ingredients []*models.Ingredient
	for _, meal := range meals {
		ingredients = append(ingredients, meal.Ingredients...)
	}
	
	return ingredients, nil
}