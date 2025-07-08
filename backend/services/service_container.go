package services

import (
	"database/sql"
)

// NewServiceContainer creates a new service container with all dependencies
func NewServiceContainer(db *sql.DB) *ServiceContainer {
	return &ServiceContainer{
		MealService:         NewMealService(db),
		IngredientService:   NewIngredientService(db),
		RecipeStepService:   NewRecipeStepService(db),
		MealPlanService:     SQLMealPlanService(db),
		ShoppingListService: NewShoppingListService(db),
		MessageService:      SQLMessageService(db),
		WorkflowService:     NewWorkflowService(db),
	}
}
