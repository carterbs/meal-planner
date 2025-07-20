package mocks

import (
	"context"
	"github.com/stretchr/testify/mock"
	apipb "mealplanner/generated/go"
	"mealplanner/models"
)

type MockShoppingListRepository struct {
	mock.Mock
}

func NewMockShoppingListRepository(t interface {
	mock.TestingT
	Cleanup(func())
}) *MockShoppingListRepository {
	mock := &MockShoppingListRepository{}
	mock.Mock.Test(t)

	t.Cleanup(func() { mock.AssertExpectations(t) })

	return mock
}

func (m *MockShoppingListRepository) GenerateShoppingListFromMeals(ctx context.Context, meals []*models.Meal) ([]*apipb.ShoppingListItem, error) {
	args := m.Called(ctx, meals)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*apipb.ShoppingListItem), args.Error(1)
}

func (m *MockShoppingListRepository) ConvertIngredientsToShoppingItems(ctx context.Context, ingredients []*models.Ingredient) ([]*apipb.ShoppingListItem, error) {
	args := m.Called(ctx, ingredients)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*apipb.ShoppingListItem), args.Error(1)
}
