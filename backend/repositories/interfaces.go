package repositories

import (
	"context"

	apipb "mealplanner/generated/go"
	"mealplanner/models"
)

// CheckpointRecord represents a checkpoint record for listing
type CheckpointRecord struct {
	ThreadID     string
	CheckpointNS string
	Checkpoint   []byte
	Metadata     []byte
}

// MealRepository handles meal-related database operations
type MealRepository interface {
	// Basic CRUD operations
	GetAllMeals(ctx context.Context) ([]*models.Meal, error)
	GetMealsByIDs(ctx context.Context, ids []int) ([]*models.Meal, error)
	GetMealByID(ctx context.Context, id int) (*models.Meal, error)
	CreateMeal(ctx context.Context, meal *models.Meal) (*models.Meal, error)
	UpdateMeal(ctx context.Context, meal *models.Meal) error
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

// WorkflowRepository handles workflow and checkpoint-related database operations
type WorkflowRepository interface {
	// Checkpoint operations
	GetWorkflowCheckpoint(ctx context.Context, threadID string) ([]byte, string, error)
	UpdateWorkflowCheckpoint(ctx context.Context, threadID string, data []byte) error
	ListWorkflows(ctx context.Context, limit int) ([]models.WorkflowStatus, error)
	
	// Message operations
	AddMessage(ctx context.Context, threadID string, sender string, message string) error
	GetMessages(ctx context.Context, threadID string) ([]models.ChatMessage, error)
	GetMessagesForProtobuf(ctx context.Context, threadID string) ([]map[string]interface{}, error)
}

// CheckpointRepository handles checkpoint-specific database operations
type CheckpointRepository interface {
	// Checkpoint CRUD
	GetCheckpoint(ctx context.Context, threadID string, ns string) (checkpoint []byte, metadata []byte, found bool, err error)
	PutCheckpoint(ctx context.Context, threadID string, ns string, workflowType string, checkpoint []byte, metadata []byte) error
	ListCheckpoints(ctx context.Context, limit int, before string) ([]CheckpointRecord, error)
}

// ShoppingListRepository handles shopping list generation (if needed for future extensions)
type ShoppingListRepository interface {
	// Shopping list operations (currently computed in-memory, but interface for future persistence)
	GenerateShoppingListFromMeals(ctx context.Context, meals []*models.Meal) ([]*models.ShoppingListItem, error)
	ConvertIngredientsToShoppingItems(ctx context.Context, ingredients []*models.Ingredient) ([]*models.ShoppingListItem, error)
}