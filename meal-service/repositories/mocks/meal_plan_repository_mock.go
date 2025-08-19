//go:build legacy
// +build legacy

package mocks

import (
	"github.com/stretchr/testify/mock"
	"mealplanner/models"
)

type MockMealPlanRepository struct {
    mock.Mock
}

// NewMockMealPlanRepository creates a mock and registers cleanup
func NewMockMealPlanRepository(t interface{
    mock.TestingT
    Cleanup(func())
}) *MockMealPlanRepository {
    m := &MockMealPlanRepository{}
    m.Mock.Test(t)
    t.Cleanup(func() { m.AssertExpectations(t) })
    return m
}

// ---------------- Interface methods ----------------
// GenerateWeeklyMealPlan
func (m *MockMealPlanRepository) GenerateWeeklyMealPlan(ctx context.Context) (*models.WeeklyMealPlan, error) {
    args := m.Called(ctx)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*models.WeeklyMealPlan), args.Error(1)
}

// GetLastPlannedMeals
func (m *MockMealPlanRepository) GetLastPlannedMeals(ctx context.Context) (*models.WeeklyMealPlan, error) {
    args := m.Called(ctx)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*models.WeeklyMealPlan), args.Error(1)
}

// PopulateMealDetails
func (m *MockMealPlanRepository) PopulateMealDetails(ctx context.Context, plan *models.WeeklyMealPlan) (*models.WeeklyMealPlan, error) {
    args := m.Called(ctx, plan)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*models.WeeklyMealPlan), args.Error(1)
}

// RemoveMealFromPlan
func (m *MockMealPlanRepository) RemoveMealFromPlan(ctx context.Context, plan *models.WeeklyMealPlan, dayIndex int, mealType string) error {
    args := m.Called(ctx, plan, dayIndex, mealType)
    return args.Error(0)
}

// GetLatestMealPlan
func (m *MockMealPlanRepository) GetLatestMealPlan(ctx context.Context, threadID string) (*models.MealPlanIdentifier, error) {
    args := m.Called(ctx, threadID)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*models.MealPlanIdentifier), args.Error(1)
}

// GetMealPlanItems
func (m *MockMealPlanRepository) GetMealPlanItems(ctx context.Context, mealPlanID int) ([]models.MealPlanEntry, error) {
    args := m.Called(ctx, mealPlanID)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).([]models.MealPlanEntry), args.Error(1)
}
	mock.Mock
}

func NewMockMealPlanRepository(t interface {
	mock.TestingT
	Cleanup(func())
}) *MockMealPlanRepository {
	mock := &MockMealPlanRepository{}
	mock.Mock.Test(t)

	t.Cleanup(func() { mock.AssertExpectations(t) })

	return mock
}

func (m *MockMealPlanRepository) GetLatestMealPlan(threadID string) (*models.MealPlan, error) {
	args := m.Called(threadID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.MealPlan), args.Error(1)
}

func (m *MockMealPlanRepository) GetMealPlanByThreadID(threadID string) (*models.MealPlan, error) {
	args := m.Called(threadID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.MealPlan), args.Error(1)
}

func (m *MockMealPlanRepository) GetMealPlanByID(id int) (*models.MealPlan, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.MealPlan), args.Error(1)
}

func (m *MockMealPlanRepository) GenerateWeeklyMealPlan() (*models.MealPlan, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.MealPlan), args.Error(1)
}

func (m *MockMealPlanRepository) GetLastPlannedMeals() (*models.MealPlan, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.MealPlan), args.Error(1)
}

func (m *MockMealPlanRepository) PopulateMealDetails(plan *models.MealPlan) (*models.MealPlan, error) {
	args := m.Called(plan)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.MealPlan), args.Error(1)
}

func (m *MockMealPlanRepository) RemoveMealFromPlan(plan *models.MealPlan, dayIndex int, mealType string) error {
	args := m.Called(plan, dayIndex, mealType)
	return args.Error(0)
}