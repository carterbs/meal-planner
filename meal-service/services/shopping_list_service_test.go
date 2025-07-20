package services

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	apipb "mealplanner/generated/go"
	"mealplanner/models"
	"mealplanner/repositories/mocks"
	"mealplanner/testutil"
)

func TestShoppingListService_BuildShoppingList_Empty(t *testing.T) {
	mockMealRepo := mocks.NewMockMealRepository(t)
	mockShoppingListRepo := mocks.NewMockShoppingListRepository(t)
	service := NewShoppingListService(mockMealRepo, mockShoppingListRepo)

	items, err := service.BuildShoppingList([]int{})
	assert.NoError(t, err)
	assert.Empty(t, items)
}

func TestShoppingListService_BuildShoppingList_WithMeals(t *testing.T) {
	tests := []struct {
		name        string
		mealIDs     []int
		setupMocks  func(*mocks.MockMealRepository, *mocks.MockShoppingListRepository)
		expectedErr string
	}{
		{
			name:    "successful shopping list generation",
			mealIDs: []int{testutil.TestMealID1, testutil.TestMealID2},
			setupMocks: func(mockMealRepo *mocks.MockMealRepository, mockShoppingListRepo *mocks.MockShoppingListRepository) {
				meals := []*models.Meal{
					testutil.NewMealBuilder().WithID(testutil.TestMealID1).WithName("Spaghetti").WithMealType("dinner").Build(),
					testutil.NewMealBuilder().WithID(testutil.TestMealID2).WithName("Salad").WithMealType("lunch").Build(),
				}
				mockMealRepo.On("GetMealsByIDs", mock.Anything, []int{testutil.TestMealID1, testutil.TestMealID2}).Return(meals, nil)

				items := []*apipb.ShoppingListItem{
					{Ingredient: "Pasta", Quantity: "1 lb"},
					{Ingredient: "Tomatoes", Quantity: "2 cups"},
				}
				mockShoppingListRepo.On("GenerateShoppingListFromMeals", mock.Anything, meals).Return(items, nil)
			},
		},
		{
			name:    "error getting meals by IDs",
			mealIDs: []int{testutil.TestMealID1},
			setupMocks: func(mockMealRepo *mocks.MockMealRepository, mockShoppingListRepo *mocks.MockShoppingListRepository) {
				mockMealRepo.On("GetMealsByIDs", mock.Anything, []int{testutil.TestMealID1}).Return(nil, testutil.ErrTestDatabase)
			},
			expectedErr: "failed to get meals by IDs",
		},
		{
			name:    "error generating shopping list from meals",
			mealIDs: []int{testutil.TestMealID1},
			setupMocks: func(mockMealRepo *mocks.MockMealRepository, mockShoppingListRepo *mocks.MockShoppingListRepository) {
				meals := []*models.Meal{
					testutil.NewMealBuilder().WithID(testutil.TestMealID1).WithName("Spaghetti").WithMealType("dinner").Build(),
				}
				mockMealRepo.On("GetMealsByIDs", mock.Anything, []int{testutil.TestMealID1}).Return(meals, nil)
				mockShoppingListRepo.On("GenerateShoppingListFromMeals", mock.Anything, meals).Return(nil, testutil.ErrTestDatabase)
			},
			expectedErr: "failed to generate shopping list from meals",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockMealRepo := mocks.NewMockMealRepository(t)
			mockShoppingListRepo := mocks.NewMockShoppingListRepository(t)
			tt.setupMocks(mockMealRepo, mockShoppingListRepo)

			service := NewShoppingListService(mockMealRepo, mockShoppingListRepo)

			items, err := service.BuildShoppingList(tt.mealIDs)

			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
				assert.Nil(t, items)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, items)
			}
		})
	}
}

func TestShoppingListService_GenerateShoppingListFromMeals(t *testing.T) {
	tests := []struct {
		name        string
		meals       []*models.Meal
		setupMocks  func(*mocks.MockShoppingListRepository)
		expectedErr string
	}{
		{
			name: "successful generation",
			meals: []*models.Meal{
				testutil.NewMealBuilder().WithID(testutil.TestMealID1).WithName("Spaghetti").WithMealType("dinner").Build(),
			},
			setupMocks: func(mockShoppingListRepo *mocks.MockShoppingListRepository) {
				items := []*apipb.ShoppingListItem{
					{Ingredient: "Pasta", Quantity: "1 lb"},
				}
				mockShoppingListRepo.On("GenerateShoppingListFromMeals", mock.Anything, mock.MatchedBy(func(meals []*models.Meal) bool {
					return len(meals) == 1 && meals[0].Name == "Spaghetti"
				})).Return(items, nil)
			},
		},
		{
			name: "repository error",
			meals: []*models.Meal{
				testutil.NewMealBuilder().WithID(testutil.TestMealID1).WithName("Spaghetti").WithMealType("dinner").Build(),
			},
			setupMocks: func(mockShoppingListRepo *mocks.MockShoppingListRepository) {
				mockShoppingListRepo.On("GenerateShoppingListFromMeals", mock.Anything, mock.MatchedBy(func(meals []*models.Meal) bool {
					return len(meals) == 1 && meals[0].Name == "Spaghetti"
				})).Return(nil, testutil.ErrTestDatabase)
			},
			expectedErr: "failed to generate shopping list from meals",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockMealRepo := mocks.NewMockMealRepository(t)
			mockShoppingListRepo := mocks.NewMockShoppingListRepository(t)
			tt.setupMocks(mockShoppingListRepo)

			service := NewShoppingListService(mockMealRepo, mockShoppingListRepo)

			items, err := service.GenerateShoppingListFromMeals(tt.meals)

			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
				assert.Nil(t, items)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, items)
			}
		})
	}
}

func TestShoppingListService_ConvertIngredientsToShoppingItems(t *testing.T) {
	tests := []struct {
		name        string
		ingredients []*models.Ingredient
		setupMocks  func(*mocks.MockShoppingListRepository)
		expectedErr string
	}{
		{
			name: "successful conversion",
			ingredients: []*models.Ingredient{
				{Id: 1, Name: "Pasta", Quantity: 1.0, Unit: "lb"},
				{Id: 2, Name: "Tomatoes", Quantity: 2.0, Unit: "cups"},
			},
			setupMocks: func(mockShoppingListRepo *mocks.MockShoppingListRepository) {
				items := []*apipb.ShoppingListItem{
					{Ingredient: "Pasta", Quantity: "1 lb"},
					{Ingredient: "Tomatoes", Quantity: "2 cups"},
				}
				mockShoppingListRepo.On("ConvertIngredientsToShoppingItems", mock.Anything, mock.MatchedBy(func(ingredients []*models.Ingredient) bool {
					return len(ingredients) == 2 && ingredients[0].Name == "Pasta" && ingredients[1].Name == "Tomatoes"
				})).Return(items, nil)
			},
		},
		{
			name: "repository error",
			ingredients: []*models.Ingredient{
				{Id: 1, Name: "Pasta", Quantity: 1.0, Unit: "lb"},
			},
			setupMocks: func(mockShoppingListRepo *mocks.MockShoppingListRepository) {
				mockShoppingListRepo.On("ConvertIngredientsToShoppingItems", mock.Anything, mock.MatchedBy(func(ingredients []*models.Ingredient) bool {
					return len(ingredients) == 1 && ingredients[0].Name == "Pasta"
				})).Return(nil, testutil.ErrTestDatabase)
			},
			expectedErr: "failed to convert ingredients to shopping list items",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockMealRepo := mocks.NewMockMealRepository(t)
			mockShoppingListRepo := mocks.NewMockShoppingListRepository(t)
			tt.setupMocks(mockShoppingListRepo)

			service := NewShoppingListService(mockMealRepo, mockShoppingListRepo)

			items, err := service.ConvertIngredientsToShoppingItems(tt.ingredients)

			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
				assert.Nil(t, items)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, items)
			}
		})
	}
}
