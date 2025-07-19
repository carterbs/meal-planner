package services

import (
	"context"
	"fmt"

	"mealplanner/logging"
	"mealplanner/models"
	"mealplanner/repositories"
)

type ingredientService struct {
	ingredientRepo repositories.IngredientRepository
}

var ingredientServiceLogger = logging.GetGrpcLogger("ingredient-service")

// NewIngredientService creates a new ingredient service instance
func NewIngredientService(ingredientRepo repositories.IngredientRepository) IngredientService {
	return &ingredientService{ingredientRepo: ingredientRepo}
}

// CreateMealIngredient creates a new ingredient for a specific meal
func (s *ingredientService) CreateMealIngredient(mealID int, ingredient *models.Ingredient) error {
	ingredientServiceLogger.Debugw("Creating ingredient for meal", "mealID", mealID, "ingredient", ingredient.GetName())
	err := s.ingredientRepo.CreateMealIngredient(context.Background(), mealID, ingredient)
	if err != nil {
		ingredientServiceLogger.Errorw("Failed to create ingredient for meal", "mealID", mealID, "error", err)
		return fmt.Errorf("failed to create ingredient for meal ID %d: %w", mealID, err)
	}
	ingredientServiceLogger.Debugw("Successfully created ingredient for meal", "mealID", mealID, "ingredient", ingredient.GetName())
	return nil
}

// UpdateMealIngredient updates an ingredient for a specific meal
func (s *ingredientService) UpdateMealIngredient(mealID int, ingredient *models.Ingredient) error {
	ingredientServiceLogger.Debugw("Updating ingredient for meal", "ingredientID", ingredient.GetId(), "mealID", mealID)
	err := s.ingredientRepo.UpdateMealIngredient(context.Background(), mealID, ingredient)
	if err != nil {
		ingredientServiceLogger.Errorw("Failed to update ingredient for meal", "ingredientID", ingredient.GetId(), "mealID", mealID, "error", err)
		return fmt.Errorf("failed to update ingredient ID %d for meal ID %d: %w", ingredient.GetId(), mealID, err)
	}
	ingredientServiceLogger.Debugw("Successfully updated ingredient for meal", "ingredientID", ingredient.GetId(), "mealID", mealID)
	return nil
}

// DeleteMealIngredient deletes an ingredient by its ID
func (s *ingredientService) DeleteMealIngredient(ingredientID int) error {
	ingredientServiceLogger.Debugw("Deleting ingredient", "ingredientID", ingredientID)
	err := s.ingredientRepo.DeleteMealIngredient(context.Background(), ingredientID)
	if err != nil {
		ingredientServiceLogger.Errorw("Failed to delete ingredient", "ingredientID", ingredientID, "error", err)
		return fmt.Errorf("failed to delete ingredient ID %d: %w", ingredientID, err)
	}
	ingredientServiceLogger.Debugw("Successfully deleted ingredient", "ingredientID", ingredientID)
	return nil
}
