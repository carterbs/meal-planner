package services

import (
	apipb "mealplanner/generated/go"
	"mealplanner/models"
)

// MealService handles meal CRUD operations and business logic
type MealService interface {
	// Retrieval operations
	GetAllMeals() ([]*models.Meal, error)
	GetMealsByIDs(ids []int) ([]*models.Meal, error)
	GetMealByID(id int) (*models.Meal, error)

	// CRUD operations
	CreateMeal(meal *models.Meal) (*models.Meal, error)
	UpdateMeal(meal *models.Meal) error
	DeleteMeal(id int) error

	// Ingredient operations
	UpdateMealIngredient(mealID int, ingredient *models.Ingredient) (*models.Meal, error)
	DeleteMealIngredient(mealID, ingredientID int) (*models.Meal, error)

	// Business operations
	SwapMeal(mealID int, mealType string) (*models.Meal, error)
	UpdateLastPlannedDates(mealIDs []int) error
}

// IngredientService handles ingredient management operations
type IngredientService interface {
	UpdateMealIngredient(mealID int, ingredient *models.Ingredient) error
	DeleteMealIngredient(ingredientID int) error
}

// RecipeStepService handles recipe step operations
type RecipeStepService interface {
	GetStepsForMeal(mealID int) ([]*models.Step, error)
	AddStepToMeal(step *models.Step) (*models.Step, error)
	AddMultipleStepsToMeal(mealID int, instructions []string) ([]*models.Step, error)
	UpdateStep(step *models.Step) error
	DeleteStep(stepID, mealID int) error
	ReorderSteps(mealID int, stepIDs []int) error
	DeleteAllStepsForMeal(mealID int) error
}

// MealPlanService handles meal plan generation and management
type MealPlanService interface {
	GenerateWeeklyMealPlan() (*apipb.WeeklyMealPlan, error)
	GetLastPlannedMeals() (*apipb.WeeklyMealPlan, error)
	PopulateMealDetails(plan *apipb.WeeklyMealPlan) (*apipb.WeeklyMealPlan, error)
	RemoveMealFromPlan(plan *apipb.WeeklyMealPlan, dayIndex int, mealType string) error

	// Persistence operations
	SaveMealPlan(threadID string, version int, entries []models.MealPlanEntry) (*models.MealPlanIdentifier, error)
	GetLatestMealPlan(threadID string) (*models.MealPlanIdentifier, error)
	GetMealPlanItems(mealPlanID int) ([]models.MealPlanEntry, error)
}

// ShoppingListService handles shopping list operations
type ShoppingListService interface {
	BuildShoppingList(mealIDs []int) ([]*apipb.ShoppingListItem, error)
	GenerateShoppingListFromMeals(meals []*models.Meal) []*models.Ingredient
	ConvertIngredientsToShoppingItems(ingredients []*models.Ingredient) []*apipb.ShoppingListItem
}

// MessageService handles chat message operations
type MessageService interface {
	GetMessages(threadID string) ([]models.ChatMessage, error)
	AddMessage(threadID, sender, message string) (models.ChatMessage, error)
	UpdateWorkflowCheckpointWithMessage(threadID, sender, message string) error
}

// WorkflowService handles workflow state management (expanded)
type WorkflowService interface {
	// Existing methods
	GetMealPlan(threadID string) (*apipb.WeeklyMealPlan, error)
	UpdateMealPlan(threadID string, plan *apipb.WeeklyMealPlan) error
	GetWorkflowState(threadID string) (*models.InternalWorkflowState, error)
	UpdateWorkflowState(threadID string, state *models.InternalWorkflowState) error

	// New methods
	GetWorkflowCheckpoint(threadID string) ([]byte, string, error)
	UpdateWorkflowCheckpoint(threadID string, data []byte) error
	UpdateWorkflowCheckpointWithMessage(threadID, sender, message string) error

	// Message operations
	AddMessage(threadID, sender, message string) (*models.ChatMessage, error)
	AddAgentMessage(threadID, text, timestamp string) error
	AddUserFeedback(threadID, from, message, timestamp string) error
}

// CheckpointService handles low level checkpoint persistence
type CheckpointService interface {
	GetCheckpoint(threadID, checkpointNS string) (checkpoint []byte, metadata []byte, found bool, err error)
	PutCheckpoint(threadID, checkpointNS, workflowType string, checkpoint []byte, metadata []byte) error
	ListCheckpoints(limit int, before string) ([]CheckpointRecord, error)
}

// CheckpointRecord represents a checkpoint entry
type CheckpointRecord struct {
	ThreadID     string
	CheckpointNS string
	Checkpoint   []byte
	Metadata     []byte
}

// ServiceContainer holds all service dependencies
type ServiceContainer struct {
	MealService         MealService
	IngredientService   IngredientService
	RecipeStepService   RecipeStepService
	MealPlanService     MealPlanService
	ShoppingListService ShoppingListService
	MessageService      MessageService
	WorkflowService     WorkflowService
	CheckpointService   CheckpointService
}
