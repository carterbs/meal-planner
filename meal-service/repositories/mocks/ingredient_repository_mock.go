package mocks

import (
	"context"

	"github.com/stretchr/testify/mock"
	"mealplanner/models"
)

// MockIngredientRepository is a mock implementation of IngredientRepository for testing
type MockIngredientRepository struct {
	mock.Mock
}

// NewMockIngredientRepository creates a new mock with cleanup
func NewMockIngredientRepository(t interface {
	mock.TestingT
	Cleanup(func())
}) *MockIngredientRepository {
	m := &MockIngredientRepository{}
	m.Mock.Test(t)
	t.Cleanup(func() { m.AssertExpectations(t) })
	return m
}

// CreateMealIngredient mock implementation
func (m *MockIngredientRepository) CreateMealIngredient(ctx context.Context, mealID int, ingredient *models.Ingredient) error {
	args := m.Called(ctx, mealID, ingredient)
	return args.Error(0)
}

// UpdateMealIngredient mock implementation
func (m *MockIngredientRepository) UpdateMealIngredient(ctx context.Context, mealID int, ingredient *models.Ingredient) error {
	args := m.Called(ctx, mealID, ingredient)
	return args.Error(0)
}

// DeleteMealIngredient mock implementation
func (m *MockIngredientRepository) DeleteMealIngredient(ctx context.Context, ingredientID int) error {
	args := m.Called(ctx, ingredientID)
	return args.Error(0)
}

// GetIngredientsForMeals mock implementation
func (m *MockIngredientRepository) GetIngredientsForMeals(ctx context.Context, mealIDs []int) ([]*models.Ingredient, error) {
	args := m.Called(ctx, mealIDs)
	return args.Get(0).([]*models.Ingredient), args.Error(1)
}
