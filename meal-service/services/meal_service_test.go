package services

import (
	"database/sql"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"mealplanner/models"
	"mealplanner/repositories/mocks"
	"mealplanner/testutil"
)

func TestMealService_GetAllMeals(t *testing.T) {
	tests := []struct {
		name        string
		setupMocks  func(*mocks.MockMealRepository, *mocks.MockIngredientRepository)
		expectedErr string
	}{
		{
			name: "successful retrieval",
			setupMocks: func(mealRepo *mocks.MockMealRepository, ingredientRepo *mocks.MockIngredientRepository) {
				expectedMeals := testutil.CreateTestMealSet()
				mealRepo.On("GetAllMeals", mock.Anything).Return(expectedMeals, nil)
			},
			expectedErr: "",
		},
		{
			name: "database error",
			setupMocks: func(mealRepo *mocks.MockMealRepository, ingredientRepo *mocks.MockIngredientRepository) {
				mealRepo.On("GetAllMeals", mock.Anything).Return(([]*models.Meal)(nil), testutil.ErrTestDatabase)
			},
			expectedErr: "failed to get all meals",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mealRepo := new(mocks.MockMealRepository)
			ingredientRepo := new(mocks.MockIngredientRepository)
			tt.setupMocks(mealRepo, ingredientRepo)

			service := NewMealService(mealRepo, ingredientRepo)

			// Execute
			meals, err := service.GetAllMeals()

			// Assert
			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
				assert.Nil(t, meals)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, meals)
				assert.Equal(t, 3, len(meals))
			}

			mealRepo.AssertExpectations(t)
			ingredientRepo.AssertExpectations(t)
		})
	}
}

func TestMealService_GetMealsByIDs(t *testing.T) {
	tests := []struct {
		name        string
		mealIDs     []int
		setupMocks  func(*mocks.MockMealRepository, *mocks.MockIngredientRepository)
		expectedErr string
	}{
		{
			name:    "successful retrieval with valid IDs",
			mealIDs: []int{testutil.TestMealID1, testutil.TestMealID2},
			setupMocks: func(mealRepo *mocks.MockMealRepository, ingredientRepo *mocks.MockIngredientRepository) {
				expectedMeals := testutil.CreateTestMealSet()[:2]
				mealRepo.On("GetMealsByIDs", mock.Anything, []int{testutil.TestMealID1, testutil.TestMealID2}).Return(expectedMeals, nil)
			},
			expectedErr: "",
		},
		{
			name:    "database error",
			mealIDs: []int{testutil.TestMealID1},
			setupMocks: func(mealRepo *mocks.MockMealRepository, ingredientRepo *mocks.MockIngredientRepository) {
				mealRepo.On("GetMealsByIDs", mock.Anything, []int{testutil.TestMealID1}).Return(([]*models.Meal)(nil), testutil.ErrTestDatabase)
			},
			expectedErr: "failed to get meals by IDs",
		},
		{
			name:    "empty ID list",
			mealIDs: []int{},
			setupMocks: func(mealRepo *mocks.MockMealRepository, ingredientRepo *mocks.MockIngredientRepository) {
				mealRepo.On("GetMealsByIDs", mock.Anything, []int{}).Return([]*models.Meal{}, nil)
			},
			expectedErr: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mealRepo := new(mocks.MockMealRepository)
			ingredientRepo := new(mocks.MockIngredientRepository)
			tt.setupMocks(mealRepo, ingredientRepo)

			service := NewMealService(mealRepo, ingredientRepo)

			// Execute
			meals, err := service.GetMealsByIDs(tt.mealIDs)

			// Assert
			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
				assert.Nil(t, meals)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, meals)
				assert.Equal(t, len(tt.mealIDs), len(meals))
			}

			mealRepo.AssertExpectations(t)
			ingredientRepo.AssertExpectations(t)
		})
	}
}

func TestMealService_GetMealByID(t *testing.T) {
	tests := []struct {
		name        string
		mealID      int
		setupMocks  func(*mocks.MockMealRepository, *mocks.MockIngredientRepository)
		expectedErr string
	}{
		{
			name:   "successful retrieval",
			mealID: testutil.TestMealID1,
			setupMocks: func(mealRepo *mocks.MockMealRepository, ingredientRepo *mocks.MockIngredientRepository) {
				expectedMeal := testutil.CreateTestMealSet()[0]
				mealRepo.On("GetMealByID", mock.Anything, testutil.TestMealID1).Return(expectedMeal, nil)
			},
			expectedErr: "",
		},
		{
			name:   "meal not found",
			mealID: testutil.TestMealID1,
			setupMocks: func(mealRepo *mocks.MockMealRepository, ingredientRepo *mocks.MockIngredientRepository) {
				mealRepo.On("GetMealByID", mock.Anything, testutil.TestMealID1).Return((*models.Meal)(nil), sql.ErrNoRows)
			},
			expectedErr: "failed to get meal with ID",
		},
		{
			name:   "database error",
			mealID: testutil.TestMealID1,
			setupMocks: func(mealRepo *mocks.MockMealRepository, ingredientRepo *mocks.MockIngredientRepository) {
				mealRepo.On("GetMealByID", mock.Anything, testutil.TestMealID1).Return((*models.Meal)(nil), testutil.ErrTestDatabase)
			},
			expectedErr: "failed to get meal with ID",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mealRepo := new(mocks.MockMealRepository)
			ingredientRepo := new(mocks.MockIngredientRepository)
			tt.setupMocks(mealRepo, ingredientRepo)

			service := NewMealService(mealRepo, ingredientRepo)

			// Execute
			meal, err := service.GetMealByID(tt.mealID)

			// Assert
			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
				assert.Nil(t, meal)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, meal)
				assert.Equal(t, int32(tt.mealID), meal.GetId())
			}

			mealRepo.AssertExpectations(t)
			ingredientRepo.AssertExpectations(t)
		})
	}
}

func TestMealService_CreateMeal(t *testing.T) {
	tests := []struct {
		name        string
		meal        *models.Meal
		setupMocks  func(*mocks.MockMealRepository, *mocks.MockIngredientRepository)
		expectedErr string
	}{
		{
			name: "successful creation",
			meal: testutil.NewMealBuilder().WithName("Test Meal").Build(),
			setupMocks: func(mealRepo *mocks.MockMealRepository, ingredientRepo *mocks.MockIngredientRepository) {
				expectedMeal := testutil.NewMealBuilder().WithName("Test Meal").Build()
				mealRepo.On("CreateMeal", mock.Anything, mock.Anything).Return(expectedMeal, nil)
			},
			expectedErr: "",
		},
		{
			name: "database error during creation",
			meal: testutil.NewMealBuilder().WithName("Test Meal").Build(),
			setupMocks: func(mealRepo *mocks.MockMealRepository, ingredientRepo *mocks.MockIngredientRepository) {
				mealRepo.On("CreateMeal", mock.Anything, mock.Anything).Return((*models.Meal)(nil), testutil.ErrTestDatabase)
			},
			expectedErr: "failed to create meal",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mealRepo := new(mocks.MockMealRepository)
			ingredientRepo := new(mocks.MockIngredientRepository)
			tt.setupMocks(mealRepo, ingredientRepo)

			service := NewMealService(mealRepo, ingredientRepo)

			// Execute
			result, err := service.CreateMeal(tt.meal)

			// Assert
			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				assert.Equal(t, tt.meal.GetName(), result.GetName())
			}

			mealRepo.AssertExpectations(t)
			ingredientRepo.AssertExpectations(t)
		})
	}
}

func TestMealService_UpdateMeal(t *testing.T) {
	tests := []struct {
		name        string
		meal        *models.Meal
		setupMocks  func(*mocks.MockMealRepository, *mocks.MockIngredientRepository)
		expectedErr string
	}{
		{
			name: "successful update",
			meal: testutil.NewMealBuilder().WithID(testutil.TestMealID1).WithName("Updated Meal").WithMealType("lunch").Build(),
			setupMocks: func(mealRepo *mocks.MockMealRepository, ingredientRepo *mocks.MockIngredientRepository) {
				updatedMeal := testutil.NewMealBuilder().WithID(testutil.TestMealID1).WithName("Updated Meal").WithMealType("lunch").Build()
				mealRepo.On("UpdateMeal", mock.Anything, mock.Anything).Return(updatedMeal, nil)
			},
			expectedErr: "",
		},
		{
			name: "database error during update",
			meal: testutil.NewMealBuilder().WithID(testutil.TestMealID1).WithName("Updated Meal").Build(),
			setupMocks: func(mealRepo *mocks.MockMealRepository, ingredientRepo *mocks.MockIngredientRepository) {
				mealRepo.On("UpdateMeal", mock.Anything, mock.Anything).Return((*models.Meal)(nil), testutil.ErrTestDatabase)
			},
			expectedErr: "failed to update meal",
		},
		{
			name: "update meal with different meal type",
			meal: testutil.NewMealBuilder().WithID(testutil.TestMealID1).WithMealType("breakfast").Build(),
			setupMocks: func(mealRepo *mocks.MockMealRepository, ingredientRepo *mocks.MockIngredientRepository) {
				updatedMeal := testutil.NewMealBuilder().WithID(testutil.TestMealID1).WithMealType("breakfast").Build()
				mealRepo.On("UpdateMeal", mock.Anything, mock.Anything).Return(updatedMeal, nil)
			},
			expectedErr: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mealRepo := new(mocks.MockMealRepository)
			ingredientRepo := new(mocks.MockIngredientRepository)
			tt.setupMocks(mealRepo, ingredientRepo)

			service := NewMealService(mealRepo, ingredientRepo)

			// Execute
			result, err := service.UpdateMeal(tt.meal)

			// Assert
			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				assert.Equal(t, tt.meal.GetId(), result.GetId())
				assert.Equal(t, tt.meal.GetName(), result.GetName())
				assert.Equal(t, tt.meal.GetMealType(), result.GetMealType())
			}

			mealRepo.AssertExpectations(t)
			ingredientRepo.AssertExpectations(t)
		})
	}
}

func TestMealService_DeleteMeal(t *testing.T) {
	tests := []struct {
		name        string
		mealID      int
		setupMocks  func(*mocks.MockMealRepository, *mocks.MockIngredientRepository)
		expectedErr string
	}{
		{
			name:   "successful deletion",
			mealID: testutil.TestMealID1,
			setupMocks: func(mealRepo *mocks.MockMealRepository, ingredientRepo *mocks.MockIngredientRepository) {
				mealRepo.On("DeleteMeal", mock.Anything, testutil.TestMealID1).Return(nil)
			},
			expectedErr: "",
		},
		{
			name:   "database error during deletion",
			mealID: testutil.TestMealID1,
			setupMocks: func(mealRepo *mocks.MockMealRepository, ingredientRepo *mocks.MockIngredientRepository) {
				mealRepo.On("DeleteMeal", mock.Anything, testutil.TestMealID1).Return(testutil.ErrTestDatabase)
			},
			expectedErr: "failed to delete meal with ID",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mealRepo := new(mocks.MockMealRepository)
			ingredientRepo := new(mocks.MockIngredientRepository)
			tt.setupMocks(mealRepo, ingredientRepo)

			service := NewMealService(mealRepo, ingredientRepo)

			// Execute
			err := service.DeleteMeal(tt.mealID)

			// Assert
			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
			} else {
				assert.NoError(t, err)
			}

			mealRepo.AssertExpectations(t)
			ingredientRepo.AssertExpectations(t)
		})
	}
}

func TestMealService_SwapMeal(t *testing.T) {
	tests := []struct {
		name        string
		mealID      int
		mealType    string
		setupMocks  func(*mocks.MockMealRepository, *mocks.MockIngredientRepository)
		expectedErr string
	}{
		{
			name:     "successful swap",
			mealID:   testutil.TestMealID1,
			mealType: testutil.MealTypeDinner,
			setupMocks: func(mealRepo *mocks.MockMealRepository, ingredientRepo *mocks.MockIngredientRepository) {
				swappedMeal := testutil.NewMealBuilder().WithID(testutil.TestMealID2).WithMealType(testutil.MealTypeDinner).Build()
				mealRepo.On("SwapMeal", mock.Anything, testutil.TestMealID1, testutil.MealTypeDinner).Return(swappedMeal, nil)
			},
			expectedErr: "",
		},
		{
			name:     "database error during swap",
			mealID:   testutil.TestMealID1,
			mealType: testutil.MealTypeDinner,
			setupMocks: func(mealRepo *mocks.MockMealRepository, ingredientRepo *mocks.MockIngredientRepository) {
				mealRepo.On("SwapMeal", mock.Anything, testutil.TestMealID1, testutil.MealTypeDinner).Return((*models.Meal)(nil), testutil.ErrTestDatabase)
			},
			expectedErr: "failed to swap meal ID",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mealRepo := new(mocks.MockMealRepository)
			ingredientRepo := new(mocks.MockIngredientRepository)
			tt.setupMocks(mealRepo, ingredientRepo)

			service := NewMealService(mealRepo, ingredientRepo)

			// Execute
			result, err := service.SwapMeal(tt.mealID, tt.mealType)

			// Assert
			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				assert.Equal(t, tt.mealType, result.GetMealType())
			}

			mealRepo.AssertExpectations(t)
			ingredientRepo.AssertExpectations(t)
		})
	}
}

func TestMealService_UpdateMealIngredient(t *testing.T) {
	tests := []struct {
		name        string
		mealID      int
		ingredient  *models.Ingredient
		setupMocks  func(*mocks.MockMealRepository, *mocks.MockIngredientRepository)
		expectedErr string
	}{
		{
			name:       "successful update",
			mealID:     testutil.TestMealID1,
			ingredient: testutil.NewIngredientBuilder().WithID(testutil.TestIngredientID1).WithName("Updated Ingredient").Build(),
			setupMocks: func(mealRepo *mocks.MockMealRepository, ingredientRepo *mocks.MockIngredientRepository) {
				ingredientRepo.On("UpdateMealIngredient", mock.Anything, testutil.TestMealID1, mock.Anything).Return(nil)
				updatedMeal := testutil.NewMealBuilder().WithID(testutil.TestMealID1).Build()
				mealRepo.On("GetMealByID", mock.Anything, testutil.TestMealID1).Return(updatedMeal, nil)
			},
			expectedErr: "",
		},
		{
			name:       "database error during update",
			mealID:     testutil.TestMealID1,
			ingredient: testutil.NewIngredientBuilder().WithID(testutil.TestIngredientID1).Build(),
			setupMocks: func(mealRepo *mocks.MockMealRepository, ingredientRepo *mocks.MockIngredientRepository) {
				ingredientRepo.On("UpdateMealIngredient", mock.Anything, testutil.TestMealID1, mock.Anything).Return(testutil.ErrTestDatabase)
			},
			expectedErr: "failed to update ingredient for meal ID",
		},
		{
			name:       "error retrieving updated meal",
			mealID:     testutil.TestMealID1,
			ingredient: testutil.NewIngredientBuilder().WithID(testutil.TestIngredientID1).Build(),
			setupMocks: func(mealRepo *mocks.MockMealRepository, ingredientRepo *mocks.MockIngredientRepository) {
				ingredientRepo.On("UpdateMealIngredient", mock.Anything, testutil.TestMealID1, mock.Anything).Return(nil)
				mealRepo.On("GetMealByID", mock.Anything, testutil.TestMealID1).Return((*models.Meal)(nil), testutil.ErrTestDatabase)
			},
			expectedErr: "failed to get updated meal",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mealRepo := new(mocks.MockMealRepository)
			ingredientRepo := new(mocks.MockIngredientRepository)
			tt.setupMocks(mealRepo, ingredientRepo)

			service := NewMealService(mealRepo, ingredientRepo)

			// Execute
			result, err := service.UpdateMealIngredient(tt.mealID, tt.ingredient)

			// Assert
			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				assert.Equal(t, int32(tt.mealID), result.GetId())
			}

			mealRepo.AssertExpectations(t)
			ingredientRepo.AssertExpectations(t)
		})
	}
}

func TestMealService_UpdateLastPlannedDates(t *testing.T) {
	tests := []struct {
		name        string
		mealIDs     []int
		setupMocks  func(*mocks.MockMealRepository, *mocks.MockIngredientRepository)
		expectedErr string
	}{
		{
			name:    "successful update",
			mealIDs: []int{testutil.TestMealID1, testutil.TestMealID2},
			setupMocks: func(mealRepo *mocks.MockMealRepository, ingredientRepo *mocks.MockIngredientRepository) {
				mealRepo.On("UpdateLastPlannedDates", mock.Anything, []int{testutil.TestMealID1, testutil.TestMealID2}).Return(nil)
			},
			expectedErr: "",
		},
		{
			name:    "database error during update",
			mealIDs: []int{testutil.TestMealID1},
			setupMocks: func(mealRepo *mocks.MockMealRepository, ingredientRepo *mocks.MockIngredientRepository) {
				mealRepo.On("UpdateLastPlannedDates", mock.Anything, []int{testutil.TestMealID1}).Return(testutil.ErrTestDatabase)
			},
			expectedErr: "failed to update last planned dates for meal IDs",
		},
		{
			name:    "empty meal IDs",
			mealIDs: []int{},
			setupMocks: func(mealRepo *mocks.MockMealRepository, ingredientRepo *mocks.MockIngredientRepository) {
				mealRepo.On("UpdateLastPlannedDates", mock.Anything, []int{}).Return(nil)
			},
			expectedErr: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mealRepo := new(mocks.MockMealRepository)
			ingredientRepo := new(mocks.MockIngredientRepository)
			tt.setupMocks(mealRepo, ingredientRepo)

			service := NewMealService(mealRepo, ingredientRepo)

			// Execute
			err := service.UpdateLastPlannedDates(tt.mealIDs)

			// Assert
			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
			} else {
				assert.NoError(t, err)
			}

			mealRepo.AssertExpectations(t)
			ingredientRepo.AssertExpectations(t)
		})
	}
}
