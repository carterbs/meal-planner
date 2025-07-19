package repositories

import (
	"context"
	"database/sql"

	"mealplanner/models"
)

// RecipeStepRepositoryImpl implements RecipeStepRepository using the existing models layer
type RecipeStepRepositoryImpl struct {
	db *sql.DB
}

// NewRecipeStepRepository creates a new RecipeStepRepositoryImpl
func NewRecipeStepRepository(db *sql.DB) *RecipeStepRepositoryImpl {
	return &RecipeStepRepositoryImpl{db: db}
}

// GetStepsForMeal retrieves all steps for a meal
func (r *RecipeStepRepositoryImpl) GetStepsForMeal(ctx context.Context, mealID int) ([]*models.Step, error) {
	return models.GetStepsForMeal(r.db, mealID)
}

// AddStepToMeal adds a single step to a meal
func (r *RecipeStepRepositoryImpl) AddStepToMeal(ctx context.Context, step *models.Step) (*models.Step, error) {
	return models.AddStepToMeal(r.db, step)
}

// AddMultipleStepsToMeal adds multiple steps to a meal
func (r *RecipeStepRepositoryImpl) AddMultipleStepsToMeal(ctx context.Context, mealID int, instructions []string) ([]*models.Step, error) {
	return models.AddMultipleStepsToMeal(r.db, mealID, instructions)
}

// UpdateStep updates an existing step
func (r *RecipeStepRepositoryImpl) UpdateStep(ctx context.Context, step *models.Step) error {
	return models.UpdateStep(r.db, step)
}

// DeleteStep deletes a single step
func (r *RecipeStepRepositoryImpl) DeleteStep(ctx context.Context, stepID int, mealID int) error {
	return models.DeleteStep(r.db, stepID, mealID)
}

// DeleteAllStepsForMeal deletes all steps for a meal
func (r *RecipeStepRepositoryImpl) DeleteAllStepsForMeal(ctx context.Context, mealID int) error {
	return models.DeleteAllStepsForMeal(r.db, mealID)
}

// ReorderSteps reorders steps for a meal
func (r *RecipeStepRepositoryImpl) ReorderSteps(ctx context.Context, mealID int, stepIDs []int) error {
	return models.ReorderSteps(r.db, mealID, stepIDs)
}