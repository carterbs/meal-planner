package services

import (
	"context"
	"fmt"

	"mealplanner/logging"
	"mealplanner/models"
	"mealplanner/repositories"
)

type recipeStepService struct {
	repo repositories.RecipeStepRepository
}

var recipeStepServiceLogger = logging.GetGrpcLogger("recipe-step-service")

// NewRecipeStepService creates a new recipe step service instance
func NewRecipeStepService(repo repositories.RecipeStepRepository) RecipeStepService {
	return &recipeStepService{repo: repo}
}

// GetStepsForMeal retrieves all steps for a given meal
func (s *recipeStepService) GetStepsForMeal(mealID int) ([]*models.Step, error) {
	steps, err := s.repo.GetStepsForMeal(context.Background(), mealID)
	if err != nil {
		return nil, fmt.Errorf("failed to get steps for meal ID %d: %w", mealID, err)
	}
	return steps, nil
}

// AddStepToMeal adds a new step to a meal
func (s *recipeStepService) AddStepToMeal(step *models.Step) (*models.Step, error) {
	recipeStepServiceLogger.Debugw("Adding step to meal", "mealID", step.GetMealId())
	result, err := s.repo.AddStepToMeal(context.Background(), step)
	if err != nil {
		recipeStepServiceLogger.Errorw("Failed to add step to meal", "mealID", step.GetMealId(), "error", err)
		return nil, fmt.Errorf("failed to add step to meal ID %d: %w", step.GetMealId(), err)
	}
	recipeStepServiceLogger.Debugw("Successfully added step to meal", "stepID", result.GetId(), "mealID", step.GetMealId())
	return result, nil
}

// AddMultipleStepsToMeal adds multiple steps to a meal in a single transaction
func (s *recipeStepService) AddMultipleStepsToMeal(mealID int, instructions []string) ([]*models.Step, error) {
	recipeStepServiceLogger.Debugw("Adding multiple steps to meal", "stepCount", len(instructions), "mealID", mealID)
	steps, err := s.repo.AddMultipleStepsToMeal(context.Background(), mealID, instructions)
	if err != nil {
		recipeStepServiceLogger.Errorw("Failed to add multiple steps to meal", "mealID", mealID, "error", err)
		return nil, fmt.Errorf("failed to add multiple steps to meal ID %d: %w", mealID, err)
	}
	recipeStepServiceLogger.Debugw("Successfully added multiple steps to meal", "stepCount", len(steps), "mealID", mealID)
	return steps, nil
}

// UpdateStep updates an existing recipe step
func (s *recipeStepService) UpdateStep(step *models.Step) error {
	recipeStepServiceLogger.Debugw("Updating step", "stepID", step.GetId(), "mealID", step.GetMealId())
	err := s.repo.UpdateStep(context.Background(), step)
	if err != nil {
		recipeStepServiceLogger.Errorw("Failed to update step", "stepID", step.GetId(), "mealID", step.GetMealId(), "error", err)
		return fmt.Errorf("failed to update step ID %d for meal ID %d: %w", step.GetId(), step.GetMealId(), err)
	}
	recipeStepServiceLogger.Debugw("Successfully updated step", "stepID", step.GetId(), "mealID", step.GetMealId())
	return nil
}

// DeleteStep deletes a recipe step
func (s *recipeStepService) DeleteStep(stepID, mealID int) error {
	recipeStepServiceLogger.Debugw("Deleting step from meal", "stepID", stepID, "mealID", mealID)
	err := s.repo.DeleteStep(context.Background(), stepID, mealID)
	if err != nil {
		recipeStepServiceLogger.Errorw("Failed to delete step from meal", "stepID", stepID, "mealID", mealID, "error", err)
		return fmt.Errorf("failed to delete step ID %d from meal ID %d: %w", stepID, mealID, err)
	}
	recipeStepServiceLogger.Debugw("Successfully deleted step from meal", "stepID", stepID, "mealID", mealID)
	return nil
}

// ReorderSteps reorders the steps for a meal
func (s *recipeStepService) ReorderSteps(mealID int, stepIDs []int) error {
	recipeStepServiceLogger.Debugw("Reordering steps for meal", "stepCount", len(stepIDs), "mealID", mealID)
	err := s.repo.ReorderSteps(context.Background(), mealID, stepIDs)
	if err != nil {
		recipeStepServiceLogger.Errorw("Failed to reorder steps for meal", "mealID", mealID, "error", err)
		return fmt.Errorf("failed to reorder steps for meal ID %d: %w", mealID, err)
	}
	recipeStepServiceLogger.Debugw("Successfully reordered steps for meal", "stepCount", len(stepIDs), "mealID", mealID)
	return nil
}

// DeleteAllStepsForMeal deletes all steps for a given meal
func (s *recipeStepService) DeleteAllStepsForMeal(mealID int) error {
	recipeStepServiceLogger.Debugw("Deleting all steps for meal", "mealID", mealID)
	err := s.repo.DeleteAllStepsForMeal(context.Background(), mealID)
	if err != nil {
		recipeStepServiceLogger.Errorw("Failed to delete all steps for meal", "mealID", mealID, "error", err)
		return fmt.Errorf("failed to delete all steps for meal ID %d: %w", mealID, err)
	}
	recipeStepServiceLogger.Debugw("Successfully deleted all steps for meal", "mealID", mealID)
	return nil
}
