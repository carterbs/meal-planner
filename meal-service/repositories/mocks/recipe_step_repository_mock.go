package mocks

import (
	"context"
	"github.com/stretchr/testify/mock"
	"mealplanner/models"
)

// MockRecipeStepRepository is a testify mock implementing repositories.RecipeStepRepository
type MockRecipeStepRepository struct {
	mock.Mock
}

// NewMockRecipeStepRepository creates a new mock and registers assertion cleanup
func NewMockRecipeStepRepository(t interface {
	mock.TestingT
	Cleanup(func())
}) *MockRecipeStepRepository {
	m := &MockRecipeStepRepository{}
	m.Mock.Test(t)
	t.Cleanup(func() { m.AssertExpectations(t) })
	return m
}

// GetStepsForMeal implements RecipeStepRepository
func (m *MockRecipeStepRepository) GetStepsForMeal(ctx context.Context, mealID int) ([]*models.Step, error) {
	args := m.Called(ctx, mealID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.Step), args.Error(1)
}

func (m *MockRecipeStepRepository) AddStepToMeal(ctx context.Context, step *models.Step) (*models.Step, error) {
	args := m.Called(ctx, step)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Step), args.Error(1)
}

func (m *MockRecipeStepRepository) AddMultipleStepsToMeal(ctx context.Context, mealID int, instructions []string) ([]*models.Step, error) {
	args := m.Called(ctx, mealID, instructions)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.Step), args.Error(1)
}

func (m *MockRecipeStepRepository) UpdateStep(ctx context.Context, step *models.Step) error {
	args := m.Called(ctx, step)
	return args.Error(0)
}

func (m *MockRecipeStepRepository) DeleteStep(ctx context.Context, stepID int, mealID int) error {
	args := m.Called(ctx, stepID, mealID)
	return args.Error(0)
}

func (m *MockRecipeStepRepository) DeleteAllStepsForMeal(ctx context.Context, mealID int) error {
	args := m.Called(ctx, mealID)
	return args.Error(0)
}

func (m *MockRecipeStepRepository) ReorderSteps(ctx context.Context, mealID int, stepIDs []int) error {
	args := m.Called(ctx, mealID, stepIDs)
	return args.Error(0)
}
