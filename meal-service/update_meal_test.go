package main

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	apipb "mealplanner/generated/go"
	"mealplanner/models"
	"mealplanner/server"
	"mealplanner/services"
)

// Modern tests for UpdateMeal functionality
func TestMealPlannerAPIServer_UpdateMeal(t *testing.T) {
	// Setup test environment without logging service
	setupTestEnvironment(t)

	// Store original services for restoration
	originalServices := server.Services

	t.Cleanup(func() {
		server.Services = originalServices
	})

	// Create gRPC server instance
	grpcServer := &MealPlannerAPIServer{}

	t.Run("successful update", func(t *testing.T) {
		// Setup
		requestMeal := &apipb.Meal{
			Id:         1,
			Name:       "Updated Meal",
			Effort:     3,
			HasRedMeat: true,
			Url:        "https://updated.com",
			MealType:   "lunch",
		}

		expectedMeal := &models.Meal{}
		expectedMeal.Id = 1
		expectedMeal.Name = "Updated Meal"
		expectedMeal.Effort = 3
		expectedMeal.HasRedMeat = true
		expectedMeal.Url = "https://updated.com"
		expectedMeal.MealType = "lunch"

		mockMealService := &MockMealService{}
		mockServices := &services.ServiceContainer{
			MealService: mockMealService,
		}
		server.Services = mockServices

		mockMealService.On("UpdateMeal", mock.Anything).Return(expectedMeal, nil)

		// Execute
		resp, err := grpcServer.UpdateMeal(context.Background(), &apipb.UpdateMealRequest{
			MealId: 1,
			Meal:   requestMeal,
		})

		// Assert
		assert.NoError(t, err)
		assert.NotNil(t, resp)
		assert.NotNil(t, resp.Meal)
		assert.Equal(t, int32(1), resp.Meal.Id)
		assert.Equal(t, "Updated Meal", resp.Meal.Name)
		assert.Equal(t, "lunch", resp.Meal.MealType)

		mockMealService.AssertExpectations(t)
	})

	t.Run("missing meal in request", func(t *testing.T) {
		// Execute
		resp, err := grpcServer.UpdateMeal(context.Background(), &apipb.UpdateMealRequest{
			MealId: 1,
			Meal:   nil,
		})

		// Assert
		assert.Error(t, err)
		assert.Nil(t, resp)
		assert.Contains(t, err.Error(), "meal is required")
	})

	t.Run("missing meal ID", func(t *testing.T) {
		// Execute
		resp, err := grpcServer.UpdateMeal(context.Background(), &apipb.UpdateMealRequest{
			MealId: 0,
			Meal:   &apipb.Meal{Name: "Test"},
		})

		// Assert
		assert.Error(t, err)
		assert.Nil(t, resp)
		assert.Contains(t, err.Error(), "meal ID is required")
	})

	t.Run("missing meal name", func(t *testing.T) {
		// Execute
		resp, err := grpcServer.UpdateMeal(context.Background(), &apipb.UpdateMealRequest{
			MealId: 1,
			Meal:   &apipb.Meal{Name: ""},
		})

		// Assert
		assert.Error(t, err)
		assert.Nil(t, resp)
		assert.Contains(t, err.Error(), "meal name is required")
	})

	t.Run("service error", func(t *testing.T) {
		// Setup
		requestMeal := &apipb.Meal{
			Id:       1,
			Name:     "Test Meal",
			MealType: "dinner",
		}

		mockMealService := &MockMealService{}
		mockServices := &services.ServiceContainer{
			MealService: mockMealService,
		}
		server.Services = mockServices

		mockMealService.On("UpdateMeal", mock.Anything).Return((*models.Meal)(nil), assert.AnError)

		// Execute
		resp, err := grpcServer.UpdateMeal(context.Background(), &apipb.UpdateMealRequest{
			MealId: 1,
			Meal:   requestMeal,
		})

		// Assert
		assert.Error(t, err)
		assert.Nil(t, resp)
		assert.Contains(t, err.Error(), "error updating meal")

		mockMealService.AssertExpectations(t)
	})

	t.Run("meal type persistence", func(t *testing.T) {
		// Setup
		requestMeal := &apipb.Meal{
			Id:       1,
			Name:     "Test Meal",
			MealType: "breakfast", // Changed from dinner to breakfast
		}

		expectedMeal := &models.Meal{}
		expectedMeal.Id = 1
		expectedMeal.Name = "Test Meal"
		expectedMeal.MealType = "breakfast"

		mockMealService := &MockMealService{}
		mockServices := &services.ServiceContainer{
			MealService: mockMealService,
		}
		server.Services = mockServices

		mockMealService.On("UpdateMeal", mock.MatchedBy(func(meal *models.Meal) bool {
			return meal.GetMealType() == "breakfast"
		})).Return(expectedMeal, nil)

		// Execute
		resp, err := grpcServer.UpdateMeal(context.Background(), &apipb.UpdateMealRequest{
			MealId: 1,
			Meal:   requestMeal,
		})

		// Assert
		assert.NoError(t, err)
		assert.NotNil(t, resp)
		assert.Equal(t, "breakfast", resp.Meal.MealType)

		mockMealService.AssertExpectations(t)
	})
}

// MockMealService is a mock implementation of MealService for testing
type MockMealService struct {
	mock.Mock
}

func (m *MockMealService) GetAllMeals() ([]*models.Meal, error) {
	args := m.Called()
	return args.Get(0).([]*models.Meal), args.Error(1)
}

func (m *MockMealService) GetMealsByIDs(ids []int) ([]*models.Meal, error) {
	args := m.Called(ids)
	return args.Get(0).([]*models.Meal), args.Error(1)
}

func (m *MockMealService) GetMealByID(id int) (*models.Meal, error) {
	args := m.Called(id)
	return args.Get(0).(*models.Meal), args.Error(1)
}

func (m *MockMealService) CreateMeal(meal *models.Meal) (*models.Meal, error) {
	args := m.Called(meal)
	return args.Get(0).(*models.Meal), args.Error(1)
}

func (m *MockMealService) UpdateMeal(meal *models.Meal) (*models.Meal, error) {
	args := m.Called(meal)
	return args.Get(0).(*models.Meal), args.Error(1)
}

func (m *MockMealService) DeleteMeal(id int) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockMealService) UpdateMealIngredient(mealID int, ingredient *models.Ingredient) (*models.Meal, error) {
	args := m.Called(mealID, ingredient)
	return args.Get(0).(*models.Meal), args.Error(1)
}

func (m *MockMealService) DeleteMealIngredient(mealID, ingredientID int) (*models.Meal, error) {
	args := m.Called(mealID, ingredientID)
	return args.Get(0).(*models.Meal), args.Error(1)
}

func (m *MockMealService) SwapMeal(mealID int, mealType string) (*models.Meal, error) {
	args := m.Called(mealID, mealType)
	return args.Get(0).(*models.Meal), args.Error(1)
}

func (m *MockMealService) UpdateLastPlannedDates(mealIDs []int) error {
	args := m.Called(mealIDs)
	return args.Error(0)
}
