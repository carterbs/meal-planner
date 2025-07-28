package repositories

import (
	"context"

	apipb "mealplanner/generated/go"
	"mealplanner/models"
)

// MealRepository handles meal-related database operations
type MealRepository interface {
	// Basic CRUD operations
	GetAllMeals(ctx context.Context) ([]*models.Meal, error)
	GetMealsByIDs(ctx context.Context, ids []int) ([]*models.Meal, error)
	GetMealByID(ctx context.Context, id int) (*models.Meal, error)
	CreateMeal(ctx context.Context, meal *models.Meal) (*models.Meal, error)
	UpdateMeal(ctx context.Context, meal *models.Meal) (*models.Meal, error)
	DeleteMeal(ctx context.Context, id int) error

	// Specialized operations
	SwapMeal(ctx context.Context, mealID int, mealType string) (*models.Meal, error)
	UpdateLastPlannedDates(ctx context.Context, mealIDs []int) error

	// Meal planning specific
	GetLastPlannedMeals(ctx context.Context) (*models.WeeklyMealPlan, error)
	GenerateWeeklyMealPlan(ctx context.Context) (*models.WeeklyMealPlan, error)
}

// IngredientRepository handles ingredient-related database operations
type IngredientRepository interface {
	// Ingredient management
	CreateMealIngredient(ctx context.Context, mealID int, ingredient *models.Ingredient) error
	UpdateMealIngredient(ctx context.Context, mealID int, ingredient *models.Ingredient) error
	DeleteMealIngredient(ctx context.Context, ingredientID int) error

	// Bulk operations for shopping lists
	GetIngredientsForMeals(ctx context.Context, mealIDs []int) ([]*models.Ingredient, error)
}

// RecipeStepRepository handles recipe step-related database operations
type RecipeStepRepository interface {
	// Step management
	GetStepsForMeal(ctx context.Context, mealID int) ([]*models.Step, error)
	AddStepToMeal(ctx context.Context, step *models.Step) (*models.Step, error)
	AddMultipleStepsToMeal(ctx context.Context, mealID int, instructions []string) ([]*models.Step, error)
	UpdateStep(ctx context.Context, step *models.Step) error
	DeleteStep(ctx context.Context, stepID int, mealID int) error
	DeleteAllStepsForMeal(ctx context.Context, mealID int) error
	ReorderSteps(ctx context.Context, mealID int, stepIDs []int) error
}

// MealPlanRepository handles meal plan-related database operations
type MealPlanRepository interface {
	// Meal plan persistence
	GetLatestMealPlan(ctx context.Context, threadID string) (*models.MealPlanIdentifier, error)
	GetMealPlanItems(ctx context.Context, mealPlanID int) ([]models.MealPlanEntry, error)
	SaveMealPlan(ctx context.Context, threadID string, version int, entries []models.MealPlanEntry) (*models.MealPlanIdentifier, error)
	RemoveMealFromPlan(ctx context.Context, plan *apipb.WeeklyMealPlan, dayIndex int, mealType string) error

	// Meal plan generation & retrieval
	GenerateWeeklyMealPlan(ctx context.Context) (*models.WeeklyMealPlan, error)
	GetLastPlannedMeals(ctx context.Context) (*models.WeeklyMealPlan, error)
	PopulateMealDetails(ctx context.Context, plan *apipb.WeeklyMealPlan) (*apipb.WeeklyMealPlan, error)
}

// ShoppingListRepository handles shopping list generation (if needed for future extensions)
type ShoppingListRepository interface {
	// Shopping list operations (currently computed in-memory, but interface for future persistence)
	GenerateShoppingListFromMeals(ctx context.Context, meals []*models.Meal) ([]*models.ShoppingListItem, error)
	ConvertIngredientsToShoppingItems(ctx context.Context, ingredients []*models.Ingredient) ([]*models.ShoppingListItem, error)
}
