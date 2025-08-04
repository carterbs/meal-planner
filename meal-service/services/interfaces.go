package services

import (
	apipb "mealplanner/generated/go"
	"mealplanner/models"
	"mealplanner/repositories"
)

// MealService handles meal CRUD operations and business logic
type MealService interface {
	// Retrieval operations
	GetAllMeals() ([]*models.Meal, error)
	GetMealsByIDs(ids []int) ([]*models.Meal, error)
	GetMealByID(id int) (*models.Meal, error)

	// CRUD operations
	CreateMeal(meal *models.Meal) (*models.Meal, error)
	UpdateMeal(meal *models.Meal) (*models.Meal, error)
	DeleteMeal(id int) error

	// Ingredient operations
	UpdateMealIngredient(mealID int, ingredient *models.Ingredient) (*models.Meal, error)
	DeleteMealIngredient(mealID, ingredientID int) (*models.Meal, error)

	// Business operations
	SwapMeal(mealID int, mealType string) (*models.Meal, error)
	UpdateLastPlannedDates(mealIDs []int) error
}



// ShoppingListService handles shopping list operations
type ShoppingListService interface {
	BuildShoppingList(mealIDs []int) ([]*apipb.ShoppingListItem, error)
	GenerateShoppingListFromMeals(meals []*models.Meal) ([]*apipb.ShoppingListItem, error)
	ConvertIngredientsToShoppingItems(ingredients []*models.Ingredient) ([]*apipb.ShoppingListItem, error)
}

// ServiceContainer holds all service dependencies
type ServiceContainer struct {
	MealService            MealService
	RecipeStepRepository   repositories.RecipeStepRepository
	MealPlanRepository     repositories.MealPlanRepository
	ShoppingListService    ShoppingListService
}
