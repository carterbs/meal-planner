package mocks

import (
	"context"
	"time"

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

func (m *MockMealPlanRepository) InsertMealPlan(ctx context.Context, weekStart, weekEnd time.Time, status models.MealPlanStatus, threadID *string) (int, error) {
	args := m.Called(ctx, weekStart, weekEnd, status, threadID)
	return args.Int(0), args.Error(1)
}

func (m *MockMealPlanRepository) GetMealPlanByID(ctx context.Context, id int) (*models.MealPlan, error) {
	args := m.Called(ctx, id)
	if plan := args.Get(0); plan != nil {
		return plan.(*models.MealPlan), args.Error(1)
	}
	return nil, args.Error(1)
}

func (m *MockMealPlanRepository) GetMealPlanByWeek(ctx context.Context, weekStart time.Time) (*models.MealPlan, error) {
	args := m.Called(ctx, weekStart)
	if plan := args.Get(0); plan != nil {
		return plan.(*models.MealPlan), args.Error(1)
	}
	return nil, args.Error(1)
}

func (m *MockMealPlanRepository) ListMealPlansInRange(ctx context.Context, start, end time.Time, status *models.MealPlanStatus) ([]*models.MealPlanSummary, error) {
	args := m.Called(ctx, start, end, status)
	if res := args.Get(0); res != nil {
		return res.([]*models.MealPlanSummary), args.Error(1)
	}
	return nil, args.Error(1)
}

func (m *MockMealPlanRepository) UpdateMealPlanStatus(ctx context.Context, id int, status models.MealPlanStatus) error {
	args := m.Called(ctx, id, status)
	return args.Error(0)
}

func (m *MockMealPlanRepository) UpdateMealPlanVersion(ctx context.Context, id int, version int) error {
	args := m.Called(ctx, id, version)
	return args.Error(0)
}

func (m *MockMealPlanRepository) UpsertMealPlanItems(ctx context.Context, mealPlanID int, items []*models.MealPlanItem) error {
	args := m.Called(ctx, mealPlanID, items)
	return args.Error(0)
}

func (m *MockMealPlanRepository) GenerateMealPlanItems(ctx context.Context) ([]*models.MealPlanItem, error) {
	args := m.Called(ctx)
	if res := args.Get(0); res != nil {
		return res.([]*models.MealPlanItem), args.Error(1)
	}
	return nil, args.Error(1)
}
