package services

import (
	"database/sql"
	"fmt"
	"log"

	"mealplanner/models"
)

type recipeStepService struct {
	db *sql.DB
}

// NewRecipeStepService creates a new recipe step service instance
func NewRecipeStepService(db *sql.DB) RecipeStepService {
	return &recipeStepService{db: db}
}

// GetStepsForMeal retrieves all steps for a given meal
func (s *recipeStepService) GetStepsForMeal(mealID int) ([]models.Step, error) {
	steps, err := models.GetStepsForMeal(s.db, mealID)
	if err != nil {
		return nil, fmt.Errorf("failed to get steps for meal ID %d: %w", mealID, err)
	}
	return steps, nil
}

// AddStepToMeal adds a new step to a meal
func (s *recipeStepService) AddStepToMeal(step models.Step) (*models.Step, error) {
	log.Printf("Adding step to meal ID %d", step.MealID)
	result, err := models.AddStepToMeal(s.db, step)
	if err != nil {
		log.Printf("Failed to add step to meal ID %d: %v", step.MealID, err)
		return nil, fmt.Errorf("failed to add step to meal ID %d: %w", step.MealID, err)
	}
	log.Printf("Successfully added step ID %d to meal ID %d", result.ID, step.MealID)
	return result, nil
}

// AddMultipleStepsToMeal adds multiple steps to a meal in a single transaction
func (s *recipeStepService) AddMultipleStepsToMeal(mealID int, instructions []string) ([]models.Step, error) {
	log.Printf("Adding %d steps to meal ID %d", len(instructions), mealID)
	steps, err := models.AddMultipleStepsToMeal(s.db, mealID, instructions)
	if err != nil {
		log.Printf("Failed to add multiple steps to meal ID %d: %v", mealID, err)
		return nil, fmt.Errorf("failed to add multiple steps to meal ID %d: %w", mealID, err)
	}
	log.Printf("Successfully added %d steps to meal ID %d", len(steps), mealID)
	return steps, nil
}

// UpdateStep updates an existing recipe step
func (s *recipeStepService) UpdateStep(step models.Step) error {
	log.Printf("Updating step ID %d for meal ID %d", step.ID, step.MealID)
	err := models.UpdateStep(s.db, step)
	if err != nil {
		log.Printf("Failed to update step ID %d for meal ID %d: %v", step.ID, step.MealID, err)
		return fmt.Errorf("failed to update step ID %d for meal ID %d: %w", step.ID, step.MealID, err)
	}
	log.Printf("Successfully updated step ID %d for meal ID %d", step.ID, step.MealID)
	return nil
}

// DeleteStep deletes a recipe step
func (s *recipeStepService) DeleteStep(stepID, mealID int) error {
	log.Printf("Deleting step ID %d from meal ID %d", stepID, mealID)
	err := models.DeleteStep(s.db, stepID, mealID)
	if err != nil {
		log.Printf("Failed to delete step ID %d from meal ID %d: %v", stepID, mealID, err)
		return fmt.Errorf("failed to delete step ID %d from meal ID %d: %w", stepID, mealID, err)
	}
	log.Printf("Successfully deleted step ID %d from meal ID %d", stepID, mealID)
	return nil
}

// ReorderSteps reorders the steps for a meal
func (s *recipeStepService) ReorderSteps(mealID int, stepIDs []int) error {
	log.Printf("Reordering %d steps for meal ID %d", len(stepIDs), mealID)
	err := models.ReorderSteps(s.db, mealID, stepIDs)
	if err != nil {
		log.Printf("Failed to reorder steps for meal ID %d: %v", mealID, err)
		return fmt.Errorf("failed to reorder steps for meal ID %d: %w", mealID, err)
	}
	log.Printf("Successfully reordered %d steps for meal ID %d", len(stepIDs), mealID)
	return nil
}

// DeleteAllStepsForMeal deletes all steps for a given meal
func (s *recipeStepService) DeleteAllStepsForMeal(mealID int) error {
	log.Printf("Deleting all steps for meal ID %d", mealID)
	err := models.DeleteAllStepsForMeal(s.db, mealID)
	if err != nil {
		log.Printf("Failed to delete all steps for meal ID %d: %v", mealID, err)
		return fmt.Errorf("failed to delete all steps for meal ID %d: %w", mealID, err)
	}
	log.Printf("Successfully deleted all steps for meal ID %d", mealID)
	return nil
}