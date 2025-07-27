package mocks

import (
	"context"

	"github.com/stretchr/testify/mock"
	"mealplanner/models"
)

// MockMealRepository is a mock implementation of MealRepository for testing
type MockMealRepository struct {
	mock.Mock
}

func NewMockMealRepository(t interface {
	mock.TestingT
	Cleanup(func())
}) *MockMealRepository {
	mock := &MockMealRepository{}
	mock.Mock.Test(t)

	t.Cleanup(func() { mock.AssertExpectations(t) })

	return mock
}

// GetAllMeals mock implementation
func (m *MockMealRepository) GetAllMeals(ctx context.Context) ([]*models.Meal, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.Meal), args.Error(1)
}

// GetMealsByIDs mock implementation
func (m *MockMealRepository) GetMealsByIDs(ctx context.Context, ids []int) ([]*models.Meal, error) {
	args := m.Called(ctx, ids)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.Meal), args.Error(1)
}

// GetMealByID mock implementation
func (m *MockMealRepository) GetMealByID(ctx context.Context, id int) (*models.Meal, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*models.Meal), args.Error(1)
}

// CreateMeal mock implementation
func (m *MockMealRepository) CreateMeal(ctx context.Context, meal *models.Meal) (*models.Meal, error) {
	args := m.Called(ctx, meal)
	return args.Get(0).(*models.Meal), args.Error(1)
}

// UpdateMeal mock implementation
func (m *MockMealRepository) UpdateMeal(ctx context.Context, meal *models.Meal) (*models.Meal, error) {
	args := m.Called(ctx, meal)
	return args.Get(0).(*models.Meal), args.Error(1)
}

// DeleteMeal mock implementation
func (m *MockMealRepository) DeleteMeal(ctx context.Context, id int) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

// SwapMeal mock implementation
func (m *MockMealRepository) SwapMeal(ctx context.Context, mealID int, mealType string) (*models.Meal, error) {
	args := m.Called(ctx, mealID, mealType)
	return args.Get(0).(*models.Meal), args.Error(1)
}

// UpdateLastPlannedDates mock implementation
func (m *MockMealRepository) UpdateLastPlannedDates(ctx context.Context, mealIDs []int) error {
	args := m.Called(ctx, mealIDs)
	return args.Error(0)
}

// GetLastPlannedMeals mock implementation
func (m *MockMealRepository) GetLastPlannedMeals(ctx context.Context) (*models.WeeklyMealPlan, error) {
	args := m.Called(ctx)
	return args.Get(0).(*models.WeeklyMealPlan), args.Error(1)
}

// GenerateWeeklyMealPlan mock implementation
func (m *MockMealRepository) GenerateWeeklyMealPlan(ctx context.Context) (*models.WeeklyMealPlan, error) {
	args := m.Called(ctx)
	return args.Get(0).(*models.WeeklyMealPlan), args.Error(1)
}
