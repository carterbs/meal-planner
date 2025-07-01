package services

import (
	"database/sql"
	"fmt"
	"log"

	"mealplanner/models"
)

type ingredientService struct {
	db *sql.DB
}

// NewIngredientService creates a new ingredient service instance
func NewIngredientService(db *sql.DB) IngredientService {
	return &ingredientService{db: db}
}

// UpdateMealIngredient updates an ingredient for a specific meal
func (s *ingredientService) UpdateMealIngredient(mealID int, ingredient models.Ingredient) error {
	log.Printf("Updating ingredient ID %d for meal ID %d", ingredient.ID, mealID)
	err := models.UpdateMealIngredient(s.db, mealID, ingredient)
	if err != nil {
		log.Printf("Failed to update ingredient ID %d for meal ID %d: %v", ingredient.ID, mealID, err)
		return fmt.Errorf("failed to update ingredient ID %d for meal ID %d: %w", ingredient.ID, mealID, err)
	}
	log.Printf("Successfully updated ingredient ID %d for meal ID %d", ingredient.ID, mealID)
	return nil
}

// DeleteMealIngredient deletes an ingredient by its ID
func (s *ingredientService) DeleteMealIngredient(ingredientID int) error {
	log.Printf("Deleting ingredient ID %d", ingredientID)
	err := models.DeleteMealIngredient(s.db, ingredientID)
	if err != nil {
		log.Printf("Failed to delete ingredient ID %d: %v", ingredientID, err)
		return fmt.Errorf("failed to delete ingredient ID %d: %w", ingredientID, err)
	}
	log.Printf("Successfully deleted ingredient ID %d", ingredientID)
	return nil
}