package services

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"mealplanner/models"
	"mealplanner/repositories/mocks"
	"mealplanner/testutil"
)

func TestRecipeStepService_GetStepsForMeal(t *testing.T) {
	mockRepo := mocks.NewMockRecipeStepRepository(t)
	service := NewRecipeStepService(mockRepo)

	exampleSteps := []*models.Step{{Id: 1, MealId: 42, Instruction: "Mix"}}
	mockRepo.On("GetStepsForMeal", mock.Anything, 42).Return(exampleSteps, nil)

	res, err := service.GetStepsForMeal(42)
	assert.NoError(t, err)
	assert.Equal(t, exampleSteps, res)

	mockRepo.AssertExpectations(t)
}

func TestRecipeStepService_GetStepsForMeal_Error(t *testing.T) {
	mockRepo := mocks.NewMockRecipeStepRepository(t)
	service := NewRecipeStepService(mockRepo)

	mockRepo.On("GetStepsForMeal", mock.Anything, 99).Return(nil, errors.New("db error"))

	res, err := service.GetStepsForMeal(99)
	assert.Error(t, err)
	assert.Nil(t, res)
}

func TestRecipeStepService_AddStepToMeal(t *testing.T) {
	mockRepo := mocks.NewMockRecipeStepRepository(t)
	service := NewRecipeStepService(mockRepo)

	input := &models.Step{MealId: 10, Instruction: "Bake"}
	output := &models.Step{Id: 5, MealId: 10, Instruction: "Bake"}
	mockRepo.On("AddStepToMeal", mock.Anything, input).Return(output, nil)

	res, err := service.AddStepToMeal(input)
	assert.NoError(t, err)
	assert.Equal(t, output, res)
}

func TestRecipeStepService_AddStepToMeal_Error(t *testing.T) {
	mockRepo := mocks.NewMockRecipeStepRepository(t)
	service := NewRecipeStepService(mockRepo)

	input := &models.Step{MealId: 11, Instruction: "Chop"}
	mockRepo.On("AddStepToMeal", mock.Anything, input).Return(nil, errors.New("fail"))

	res, err := service.AddStepToMeal(input)
	assert.Error(t, err)
	assert.Nil(t, res)
}

func TestRecipeStepService_AddMultipleStepsToMeal(t *testing.T) {
	tests := []struct {
		name         string
		mealID       int
		instructions []string
		setupMocks   func(*mocks.MockRecipeStepRepository)
		expectedErr  string
	}{
		{
			name:         "successful multiple steps addition",
			mealID:       testutil.TestMealID1,
			instructions: []string{"Preheat oven to 350°F", "Mix ingredients", "Bake for 25 minutes"},
			setupMocks: func(mockRepo *mocks.MockRecipeStepRepository) {
				expectedSteps := []*models.Step{
					{Id: 1, MealId: int32(testutil.TestMealID1), StepNumber: 1, Instruction: "Preheat oven to 350°F"},
					{Id: 2, MealId: int32(testutil.TestMealID1), StepNumber: 2, Instruction: "Mix ingredients"},
					{Id: 3, MealId: int32(testutil.TestMealID1), StepNumber: 3, Instruction: "Bake for 25 minutes"},
				}
				mockRepo.On("AddMultipleStepsToMeal", mock.Anything, testutil.TestMealID1, []string{"Preheat oven to 350°F", "Mix ingredients", "Bake for 25 minutes"}).Return(expectedSteps, nil)
			},
		},
		{
			name:         "empty instructions list",
			mealID:       testutil.TestMealID1,
			instructions: []string{},
			setupMocks: func(mockRepo *mocks.MockRecipeStepRepository) {
				mockRepo.On("AddMultipleStepsToMeal", mock.Anything, testutil.TestMealID1, []string{}).Return([]*models.Step{}, nil)
			},
		},
		{
			name:         "single instruction",
			mealID:       testutil.TestMealID1,
			instructions: []string{"Serve immediately"},
			setupMocks: func(mockRepo *mocks.MockRecipeStepRepository) {
				expectedSteps := []*models.Step{
					{Id: 1, MealId: int32(testutil.TestMealID1), StepNumber: 1, Instruction: "Serve immediately"},
				}
				mockRepo.On("AddMultipleStepsToMeal", mock.Anything, testutil.TestMealID1, []string{"Serve immediately"}).Return(expectedSteps, nil)
			},
		},
		{
			name:         "database error during addition",
			mealID:       testutil.TestMealID1,
			instructions: []string{"Test step"},
			setupMocks: func(mockRepo *mocks.MockRecipeStepRepository) {
				mockRepo.On("AddMultipleStepsToMeal", mock.Anything, testutil.TestMealID1, []string{"Test step"}).Return(nil, testutil.ErrTestDatabase)
			},
			expectedErr: "failed to add multiple steps to meal ID",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := mocks.NewMockRecipeStepRepository(t)
			tt.setupMocks(mockRepo)

			service := NewRecipeStepService(mockRepo)

			steps, err := service.AddMultipleStepsToMeal(tt.mealID, tt.instructions)

			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
				assert.Nil(t, steps)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, len(tt.instructions), len(steps))
				for i, step := range steps {
					assert.Equal(t, int32(tt.mealID), step.MealId)
					assert.Equal(t, tt.instructions[i], step.Instruction)
				}
			}
		})
	}
}

func TestRecipeStepService_UpdateStep(t *testing.T) {
	tests := []struct {
		name        string
		step        *models.Step
		setupMocks  func(*mocks.MockRecipeStepRepository)
		expectedErr string
	}{
		{
			name: "successful step update",
			step: &models.Step{
				Id:          testutil.TestStepID1,
				MealId:      int32(testutil.TestMealID1),
				StepNumber:  1,
				Instruction: "Updated instruction",
			},
			setupMocks: func(mockRepo *mocks.MockRecipeStepRepository) {
				mockRepo.On("UpdateStep", mock.Anything, mock.MatchedBy(func(step *models.Step) bool {
					return step.Id == testutil.TestStepID1 && step.Instruction == "Updated instruction"
				})).Return(nil)
			},
		},
		{
			name: "database error during update",
			step: &models.Step{
				Id:          testutil.TestStepID1,
				MealId:      int32(testutil.TestMealID1),
				StepNumber:  1,
				Instruction: "Test instruction",
			},
			setupMocks: func(mockRepo *mocks.MockRecipeStepRepository) {
				mockRepo.On("UpdateStep", mock.Anything, mock.MatchedBy(func(step *models.Step) bool {
					return step.Id == testutil.TestStepID1 && step.Instruction == "Test instruction"
				})).Return(testutil.ErrTestDatabase)
			},
			expectedErr: "failed to update step ID",
		},
		{
			name: "update with empty instruction",
			step: &models.Step{
				Id:          testutil.TestStepID1,
				MealId:      int32(testutil.TestMealID1),
				StepNumber:  1,
				Instruction: "",
			},
			setupMocks: func(mockRepo *mocks.MockRecipeStepRepository) {
				mockRepo.On("UpdateStep", mock.Anything, mock.MatchedBy(func(step *models.Step) bool {
					return step.Id == testutil.TestStepID1 && step.Instruction == ""
				})).Return(nil)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := mocks.NewMockRecipeStepRepository(t)
			tt.setupMocks(mockRepo)

			service := NewRecipeStepService(mockRepo)

			err := service.UpdateStep(tt.step)

			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestRecipeStepService_DeleteStep(t *testing.T) {
	tests := []struct {
		name        string
		stepID      int
		mealID      int
		setupMocks  func(*mocks.MockRecipeStepRepository)
		expectedErr string
	}{
		{
			name:   "successful step deletion",
			stepID: testutil.TestStepID1,
			mealID: testutil.TestMealID1,
			setupMocks: func(mockRepo *mocks.MockRecipeStepRepository) {
				mockRepo.On("DeleteStep", mock.Anything, testutil.TestStepID1, testutil.TestMealID1).Return(nil)
			},
		},
		{
			name:   "database error during deletion",
			stepID: testutil.TestStepID1,
			mealID: testutil.TestMealID1,
			setupMocks: func(mockRepo *mocks.MockRecipeStepRepository) {
				mockRepo.On("DeleteStep", mock.Anything, testutil.TestStepID1, testutil.TestMealID1).Return(testutil.ErrTestDatabase)
			},
			expectedErr: "failed to delete step ID",
		},
		{
			name:   "delete step with different meal ID",
			stepID: testutil.TestStepID1,
			mealID: testutil.TestMealID2,
			setupMocks: func(mockRepo *mocks.MockRecipeStepRepository) {
				mockRepo.On("DeleteStep", mock.Anything, testutil.TestStepID1, testutil.TestMealID2).Return(nil)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := mocks.NewMockRecipeStepRepository(t)
			tt.setupMocks(mockRepo)

			service := NewRecipeStepService(mockRepo)

			err := service.DeleteStep(tt.stepID, tt.mealID)

			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestRecipeStepService_ReorderSteps(t *testing.T) {
	tests := []struct {
		name        string
		mealID      int
		stepIDs     []int
		setupMocks  func(*mocks.MockRecipeStepRepository)
		expectedErr string
	}{
		{
			name:    "successful step reordering",
			mealID:  testutil.TestMealID1,
			stepIDs: []int{testutil.TestStepID3, testutil.TestStepID1, testutil.TestStepID2},
			setupMocks: func(mockRepo *mocks.MockRecipeStepRepository) {
				mockRepo.On("ReorderSteps", mock.Anything, testutil.TestMealID1, []int{testutil.TestStepID3, testutil.TestStepID1, testutil.TestStepID2}).Return(nil)
			},
		},
		{
			name:    "empty step IDs list",
			mealID:  testutil.TestMealID1,
			stepIDs: []int{},
			setupMocks: func(mockRepo *mocks.MockRecipeStepRepository) {
				mockRepo.On("ReorderSteps", mock.Anything, testutil.TestMealID1, []int{}).Return(nil)
			},
		},
		{
			name:    "single step reordering",
			mealID:  testutil.TestMealID1,
			stepIDs: []int{testutil.TestStepID1},
			setupMocks: func(mockRepo *mocks.MockRecipeStepRepository) {
				mockRepo.On("ReorderSteps", mock.Anything, testutil.TestMealID1, []int{testutil.TestStepID1}).Return(nil)
			},
		},
		{
			name:    "database error during reordering",
			mealID:  testutil.TestMealID1,
			stepIDs: []int{testutil.TestStepID1, testutil.TestStepID2},
			setupMocks: func(mockRepo *mocks.MockRecipeStepRepository) {
				mockRepo.On("ReorderSteps", mock.Anything, testutil.TestMealID1, []int{testutil.TestStepID1, testutil.TestStepID2}).Return(testutil.ErrTestDatabase)
			},
			expectedErr: "failed to reorder steps for meal ID",
		},
		{
			name:    "large number of steps",
			mealID:  testutil.TestMealID1,
			stepIDs: []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15},
			setupMocks: func(mockRepo *mocks.MockRecipeStepRepository) {
				mockRepo.On("ReorderSteps", mock.Anything, testutil.TestMealID1, []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15}).Return(nil)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := mocks.NewMockRecipeStepRepository(t)
			tt.setupMocks(mockRepo)

			service := NewRecipeStepService(mockRepo)

			err := service.ReorderSteps(tt.mealID, tt.stepIDs)

			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestRecipeStepService_DeleteAllStepsForMeal(t *testing.T) {
	tests := []struct {
		name        string
		mealID      int
		setupMocks  func(*mocks.MockRecipeStepRepository)
		expectedErr string
	}{
		{
			name:   "successful deletion of all steps",
			mealID: testutil.TestMealID1,
			setupMocks: func(mockRepo *mocks.MockRecipeStepRepository) {
				mockRepo.On("DeleteAllStepsForMeal", mock.Anything, testutil.TestMealID1).Return(nil)
			},
		},
		{
			name:   "database error during deletion",
			mealID: testutil.TestMealID1,
			setupMocks: func(mockRepo *mocks.MockRecipeStepRepository) {
				mockRepo.On("DeleteAllStepsForMeal", mock.Anything, testutil.TestMealID1).Return(testutil.ErrTestDatabase)
			},
			expectedErr: "failed to delete all steps for meal ID",
		},
		{
			name:   "delete all steps for meal with no steps",
			mealID: testutil.TestMealID2,
			setupMocks: func(mockRepo *mocks.MockRecipeStepRepository) {
				mockRepo.On("DeleteAllStepsForMeal", mock.Anything, testutil.TestMealID2).Return(nil)
			},
		},
		{
			name:   "delete all steps for non-existent meal",
			mealID: 999,
			setupMocks: func(mockRepo *mocks.MockRecipeStepRepository) {
				mockRepo.On("DeleteAllStepsForMeal", mock.Anything, 999).Return(nil)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := mocks.NewMockRecipeStepRepository(t)
			tt.setupMocks(mockRepo)

			service := NewRecipeStepService(mockRepo)

			err := service.DeleteAllStepsForMeal(tt.mealID)

			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
