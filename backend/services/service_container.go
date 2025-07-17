package services

import (
	"database/sql"
	"mealplanner/repositories"
)

// NewServiceContainer creates a new service container with all dependencies
func NewServiceContainer(db *sql.DB) *ServiceContainer {
	// Create repository instances
	mealRepo := repositories.NewMealRepository(db)
	ingredientRepo := repositories.NewIngredientRepository(db)
	recipeStepRepo := repositories.NewRecipeStepRepository(db)
	mealPlanRepo := repositories.NewMealPlanRepository(db)
	checkpointRepo := repositories.NewCheckpointRepository(db)
	workflowRepo := repositories.NewWorkflowRepository(db)
	shoppingListRepo := repositories.NewShoppingListRepository(db)

	// Create services with repository dependencies
	return &ServiceContainer{
		MealService:         NewMealService(mealRepo, ingredientRepo),
		IngredientService:   NewIngredientService(ingredientRepo),
		RecipeStepService:   NewRecipeStepService(recipeStepRepo),
		MealPlanService:     NewMealPlanService(mealPlanRepo),
		ShoppingListService: NewShoppingListService(mealRepo, shoppingListRepo),
		MessageService:      NewMessageService(workflowRepo),
		WorkflowService:     NewWorkflowService(workflowRepo, mealPlanRepo),
		CheckpointService:   NewCheckpointService(checkpointRepo),
	}
}
