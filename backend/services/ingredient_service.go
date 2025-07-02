package services

import (
	"database/sql"
	"fmt"

	"mealplanner/logging"
	"mealplanner/models"
)

type ingredientService struct {
	db *sql.DB
}

var ingredientServiceLogger = logging.GetLogger("ingredient-service")

// NewIngredientService creates a new ingredient service instance
func NewIngredientService(db *sql.DB) IngredientService {
	return &ingredientService{db: db}
}

// UpdateMealIngredient updates an ingredient for a specific meal
func (s *ingredientService) UpdateMealIngredient(mealID int, ingredient models.Ingredient) error {
	ingredientServiceLogger.Debugw("Updating ingredient for meal", "ingredientID", ingredient.ID, "mealID", mealID)
	err := models.UpdateMealIngredient(s.db, mealID, ingredient)
	if err != nil {
		ingredientServiceLogger.Errorw("Failed to update ingredient for meal", "ingredientID", ingredient.ID, "mealID", mealID, "error", err)
		return fmt.Errorf("failed to update ingredient ID %d for meal ID %d: %w", ingredient.ID, mealID, err)
	}
	ingredientServiceLogger.Debugw("Successfully updated ingredient for meal", "ingredientID", ingredient.ID, "mealID", mealID)
	return nil
}

// DeleteMealIngredient deletes an ingredient by its ID
func (s *ingredientService) DeleteMealIngredient(ingredientID int) error {
	ingredientServiceLogger.Debugw("Deleting ingredient", "ingredientID", ingredientID)
	err := models.DeleteMealIngredient(s.db, ingredientID)
	if err != nil {
		ingredientServiceLogger.Errorw("Failed to delete ingredient", "ingredientID", ingredientID, "error", err)
		return fmt.Errorf("failed to delete ingredient ID %d: %w", ingredientID, err)
	}
	ingredientServiceLogger.Debugw("Successfully deleted ingredient", "ingredientID", ingredientID)
	return nil
}
