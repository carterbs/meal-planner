package services

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"mealplanner/models"
	"mealplanner/repositories/mocks"
)

func TestIngredientService_UpdateMealIngredient(t *testing.T) {
	mockRepo := mocks.NewMockIngredientRepository(t)
	service := NewIngredientService(mockRepo)

	ing := &models.Ingredient{Id: 2, Name: "Salt"}
	mockRepo.On("UpdateMealIngredient", mock.Anything, 1, ing).Return(nil)

	err := service.UpdateMealIngredient(1, ing)
	assert.NoError(t, err)
}

func TestIngredientService_UpdateMealIngredient_Error(t *testing.T) {
	mockRepo := mocks.NewMockIngredientRepository(t)
	service := NewIngredientService(mockRepo)

	ing := &models.Ingredient{Id: 3, Name: "Pepper"}
	mockRepo.On("UpdateMealIngredient", mock.Anything, 2, ing).Return(errors.New("oops"))

	err := service.UpdateMealIngredient(2, ing)
	assert.Error(t, err)
}

func TestIngredientService_DeleteMealIngredient(t *testing.T) {
	mockRepo := mocks.NewMockIngredientRepository(t)
	service := NewIngredientService(mockRepo)

	mockRepo.On("DeleteMealIngredient", mock.Anything, 4).Return(nil)
	assert.NoError(t, service.DeleteMealIngredient(4))
}

func TestIngredientService_DeleteMealIngredient_Error(t *testing.T) {
	mockRepo := mocks.NewMockIngredientRepository(t)
	service := NewIngredientService(mockRepo)

	mockRepo.On("DeleteMealIngredient", mock.Anything, 5).Return(errors.New("fail"))
	assert.Error(t, service.DeleteMealIngredient(5))
}
