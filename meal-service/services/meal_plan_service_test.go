package services

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	apipb "mealplanner/generated/go"
	"mealplanner/repositories/mocks"
)

func TestMealPlanService_GenerateWeeklyMealPlan(t *testing.T) {
	mockRepo := mocks.NewMockMealPlanRepository(t)
	service := NewMealPlanService(mockRepo)

	expected := &apipb.WeeklyMealPlan{Days: []*apipb.MealPlanEntry{{DayIndex: 0}}}
	mockRepo.On("GenerateWeeklyMealPlan", mock.Anything).Return(expected, nil)

	res, err := service.GenerateWeeklyMealPlan()
	assert.NoError(t, err)
	assert.Equal(t, expected, res)
}

func TestMealPlanService_GenerateWeeklyMealPlan_Error(t *testing.T) {
	mockRepo := mocks.NewMockMealPlanRepository(t)
	service := NewMealPlanService(mockRepo)

	mockRepo.On("GenerateWeeklyMealPlan", mock.Anything).Return(nil, errors.New("err"))
	_, err := service.GenerateWeeklyMealPlan()
	assert.Error(t, err)
}

func TestMealPlanService_GetLastPlannedMeals(t *testing.T) {
	mockRepo := mocks.NewMockMealPlanRepository(t)
	service := NewMealPlanService(mockRepo)

	expected := &apipb.WeeklyMealPlan{Days: []*apipb.MealPlanEntry{{DayIndex: 1}}}
	mockRepo.On("GetLastPlannedMeals", mock.Anything).Return(expected, nil)

	res, err := service.GetLastPlannedMeals()
	assert.NoError(t, err)
	assert.Equal(t, expected, res)
}

func TestMealPlanService_PopulateMealDetails_NilPlan(t *testing.T) {
	service := NewMealPlanService(nil)
	_, err := service.PopulateMealDetails(nil)
	assert.Error(t, err)
}
