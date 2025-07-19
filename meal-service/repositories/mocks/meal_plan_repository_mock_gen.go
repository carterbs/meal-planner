package mocks

import (
    "context"
    "github.com/stretchr/testify/mock"
    "mealplanner/models"
)

// MockMealPlanRepository satisfies repositories.MealPlanRepository for tests.
type MockMealPlanRepository struct {
    mock.Mock
}

// NewMockMealPlanRepository returns a mock with expectation cleanup.
func NewMockMealPlanRepository(t interface {
    mock.TestingT
    Cleanup(func())
}) *MockMealPlanRepository {
    m := &MockMealPlanRepository{}
    m.Mock.Test(t)
    t.Cleanup(func() { m.AssertExpectations(t) })
    return m
}

// GenerateWeeklyMealPlan implements MealPlanRepository.
func (m *MockMealPlanRepository) GenerateWeeklyMealPlan(ctx context.Context) (*models.WeeklyMealPlan, error) {
    args := m.Called(ctx)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*models.WeeklyMealPlan), args.Error(1)
}

func (m *MockMealPlanRepository) GetLastPlannedMeals(ctx context.Context) (*models.WeeklyMealPlan, error) {
    args := m.Called(ctx)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*models.WeeklyMealPlan), args.Error(1)
}

func (m *MockMealPlanRepository) PopulateMealDetails(ctx context.Context, plan *models.WeeklyMealPlan) (*models.WeeklyMealPlan, error) {
    args := m.Called(ctx, plan)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*models.WeeklyMealPlan), args.Error(1)
}

func (m *MockMealPlanRepository) RemoveMealFromPlan(ctx context.Context, plan *models.WeeklyMealPlan, dayIndex int, mealType string) error {
    args := m.Called(ctx, plan, dayIndex, mealType)
    return args.Error(0)
}

func (m *MockMealPlanRepository) SaveMealPlan(ctx context.Context, threadID string, version int, entries []models.MealPlanEntry) (*models.MealPlanIdentifier, error) {
    args := m.Called(ctx, threadID, version, entries)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*models.MealPlanIdentifier), args.Error(1)
}

func (m *MockMealPlanRepository) GetLatestMealPlan(ctx context.Context, threadID string) (*models.MealPlanIdentifier, error) {
    args := m.Called(ctx, threadID)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*models.MealPlanIdentifier), args.Error(1)
}

func (m *MockMealPlanRepository) GetMealPlanItems(ctx context.Context, mealPlanID int) ([]models.MealPlanEntry, error) {
    args := m.Called(ctx, mealPlanID)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).([]models.MealPlanEntry), args.Error(1)
}
