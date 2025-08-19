package services

import (
	"context"
	"fmt"

	"go.uber.org/zap"

	apipb "mealplanner/generated/go"
	"mealplanner/logging"
	"mealplanner/models"
	"mealplanner/repositories"
)

type shoppingListService struct {
	mealRepo         repositories.MealRepository
	shoppingListRepo repositories.ShoppingListRepository
}

func getShoppingListServiceLogger() *zap.SugaredLogger {
	return logging.GetGrpcLogger("shopping-list-service")
}

// NewShoppingListService creates a new shopping list service instance
func NewShoppingListService(mealRepo repositories.MealRepository, shoppingListRepo repositories.ShoppingListRepository) ShoppingListService {
	return &shoppingListService{
		mealRepo:         mealRepo,
		shoppingListRepo: shoppingListRepo,
	}
}

// BuildShoppingList builds a shopping list from meal IDs
func (s *shoppingListService) BuildShoppingList(mealIDs []int) ([]*apipb.ShoppingListItem, error) {
	if len(mealIDs) == 0 {
		getShoppingListServiceLogger().Info("No meal IDs provided for shopping list")
		return []*apipb.ShoppingListItem{}, nil
	}

	getShoppingListServiceLogger().Debugw("Building shopping list for meals", "mealCount", len(mealIDs))

	// Get meals with full ingredient details
	meals, err := s.mealRepo.GetMealsByIDs(context.Background(), mealIDs)
	if err != nil {
		getShoppingListServiceLogger().Errorw("Failed to get meals by IDs for shopping list", "error", err)
		return nil, fmt.Errorf("failed to get meals by IDs: %w", err)
	}

	// Generate shopping list from meals
	items, err := s.shoppingListRepo.GenerateShoppingListFromMeals(context.Background(), meals)
	if err != nil {
		getShoppingListServiceLogger().Errorw("Failed to generate shopping list from meals", "error", err)
		return nil, fmt.Errorf("failed to generate shopping list from meals: %w", err)
	}

	getShoppingListServiceLogger().Debugw("Generated shopping list with unique items", "itemCount", len(items))
	return items, nil
}

// GenerateShoppingListFromMeals aggregates ingredients from meals
func (s *shoppingListService) GenerateShoppingListFromMeals(meals []*models.Meal) ([]*apipb.ShoppingListItem, error) {
	getShoppingListServiceLogger().Debugw("Generating shopping list from meals", "mealCount", len(meals))
	items, err := s.shoppingListRepo.GenerateShoppingListFromMeals(context.Background(), meals)
	if err != nil {
		getShoppingListServiceLogger().Errorw("Failed to generate shopping list from meals", "error", err)
		return nil, fmt.Errorf("failed to generate shopping list from meals: %w", err)
	}
	getShoppingListServiceLogger().Debugw("Generated shopping list items", "itemCount", len(items))
	return items, nil
}

// ConvertIngredientsToShoppingItems converts ingredients to shopping list items
func (s *shoppingListService) ConvertIngredientsToShoppingItems(ingredients []*models.Ingredient) ([]*apipb.ShoppingListItem, error) {
	getShoppingListServiceLogger().Debugw("Converting ingredients to shopping list items", "ingredientCount", len(ingredients))
	items, err := s.shoppingListRepo.ConvertIngredientsToShoppingItems(context.Background(), ingredients)
	if err != nil {
		getShoppingListServiceLogger().Errorw("Failed to convert ingredients to shopping list items", "error", err)
		return nil, fmt.Errorf("failed to convert ingredients to shopping list items: %w", err)
	}
	getShoppingListServiceLogger().Debugw("Converted to shopping list items", "itemCount", len(items))
	return items, nil
}
