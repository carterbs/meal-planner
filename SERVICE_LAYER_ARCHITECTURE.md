# Service Layer Architecture Plan

## Overview

This document outlines the comprehensive service layer architecture to isolate all database access behind clean interfaces, improving maintainability, testability, and separation of concerns.

## Current State Analysis

### Database Operations by Handler

**agent.go**: 
- `models.UpdateWorkflowCheckpoint()` - Workflow state persistence
- `models.AddMessage()` - Chat message storage
- `models.GetWorkflowCheckpoint()` - Workflow state retrieval

**mealplan.go**:
- `models.GetMealsByIDs()` - Meal detail population
- `models.GetLastPlannedMeals()` - Historical meal plans
- `models.GenerateWeeklyMealPlan()` - New meal plan creation
- `models.GenerateShoppingListFromMeals()` - Shopping list generation
- `models.ConvertIngredientsToShoppingItems()` - Shopping list formatting

**meals.go**:
- `models.GetAllMeals()` - Meal catalog retrieval
- `models.RemoveMealFromPlan()` - Meal plan modification
- `models.SwapMeal()` - Meal replacement
- `models.UpdateMealIngredient()` - Ingredient updates
- `models.DeleteMealIngredient()` - Ingredient removal
- `models.GetMealsByIDs()` - Meal retrieval by IDs
- `models.DeleteMeal()` - Meal deletion
- `models.UpdateLastPlannedDates()` - Meal planning history
- `models.CreateMeal()` - New meal creation

**steps.go**:
- `models.GetStepsForMeal()` - Recipe step retrieval
- `models.AddStepToMeal()` - Single step addition
- `models.AddMultipleStepsToMeal()` - Bulk step addition
- `models.UpdateStep()` - Step modification
- `models.DeleteStep()` - Step removal
- `models.DeleteAllStepsForMeal()` - Bulk step removal

**workflows.go**:
- `models.GetMessages()` - Chat message retrieval
- `models.GetWorkflowCheckpoint()` - Workflow state access
- `models.UpdateWorkflowCheckpointWithMessage()` - Workflow + message updates
- `models.AddMessage()` - Message addition

### Model Domain Areas

1. **Meals & Ingredients** (`meal.go`, `ingredient.go`)
2. **Recipe Steps** (`step.go`)
3. **Meal Plans** (`mealplan.go`)
4. **Shopping Lists** (`shoppinglist.go`)
5. **Workflow State** (`checkpoint.go`, `workflow.go`)
6. **Chat Messages** (`checkpoint.go`)

## Target Architecture

### Service Layer Structure

```
backend/services/
├── interfaces.go           # All service interface definitions
├── meal_service.go         # Meal CRUD operations
├── ingredient_service.go   # Ingredient management
├── recipe_step_service.go  # Recipe step operations
├── meal_plan_service.go    # Meal plan generation & management
├── shopping_list_service.go # Shopping list operations
├── message_service.go      # Chat message operations
├── workflow_service.go     # Workflow state management (expand existing)
├── service_container.go    # Dependency injection container
└── mocks/                  # Auto-generated mocks for testing
    ├── meal_service_mock.go
    ├── ingredient_service_mock.go
    └── ...
```

### Service Interfaces

#### MealService
```go
type MealService interface {
    // Retrieval operations
    GetAllMeals() ([]*models.Meal, error)
    GetMealsByIDs(ids []int) ([]*models.Meal, error)
    
    // CRUD operations
    CreateMeal(meal models.Meal) (*models.Meal, error)
    UpdateMeal(meal *models.Meal) error
    DeleteMeal(id int) error
    
    // Business operations
    SwapMeal(mealID int, mealType string) (*models.Meal, error)
    UpdateLastPlannedDates(mealIDs []int) error
}
```

#### IngredientService
```go
type IngredientService interface {
    UpdateMealIngredient(mealID int, ingredient models.Ingredient) error
    DeleteMealIngredient(ingredientID int) error
}
```

#### RecipeStepService
```go
type RecipeStepService interface {
    GetStepsForMeal(mealID int) ([]models.Step, error)
    AddStepToMeal(step models.Step) (*models.Step, error)
    AddMultipleStepsToMeal(mealID int, instructions []string) ([]models.Step, error)
    UpdateStep(step models.Step) error
    DeleteStep(stepID, mealID int) error
    ReorderSteps(mealID int, stepOrders []models.StepReorder) error
    DeleteAllStepsForMeal(mealID int) error
}
```

#### MealPlanService
```go
type MealPlanService interface {
    GenerateWeeklyMealPlan() (*models.WeeklyMealPlan, error)
    GetLastPlannedMeals() (*models.WeeklyMealPlan, error)
    PopulateMealDetails(plan *models.WeeklyMealPlan) (*models.WeeklyMealPlan, error)
    RemoveMealFromPlan(plan *models.WeeklyMealPlan, dayIndex int, mealType string) error
}
```

#### ShoppingListService
```go
type ShoppingListService interface {
    BuildShoppingList(mealIDs []int) ([]models.ShoppingListItem, error)
    GenerateShoppingListFromMeals(meals []*models.Meal) []models.Ingredient
    ConvertIngredientsToShoppingItems(ingredients []models.Ingredient) []models.ShoppingListItem
}
```

#### MessageService
```go
type MessageService interface {
    GetMessages(threadID string) ([]models.ChatMessage, error)
    AddMessage(threadID, sender, message string) (models.ChatMessage, error)
    UpdateWorkflowCheckpointWithMessage(threadID, sender, message string) error
}
```

#### WorkflowService (expanded)
```go
type WorkflowService interface {
    // Existing methods
    GetMealPlan(threadID string) (*models.WeeklyMealPlan, error)
    UpdateMealPlan(threadID string, plan *models.WeeklyMealPlan) error
    GetWorkflowState(threadID string) (*models.InternalWorkflowState, error)
    UpdateWorkflowState(threadID string, state *models.InternalWorkflowState) error
    
    // New methods
    GetWorkflowCheckpoint(threadID string) ([]byte, string, error)
    UpdateWorkflowCheckpoint(threadID string, data []byte) error
}
```

#### ServiceContainer
```go
type ServiceContainer struct {
    MealService         MealService
    IngredientService   IngredientService
    RecipeStepService   RecipeStepService
    MealPlanService     MealPlanService
    ShoppingListService ShoppingListService
    MessageService      MessageService
    WorkflowService     WorkflowService
}

func NewServiceContainer(db *sql.DB) *ServiceContainer
```

## Implementation Plan

### Phase 1: Service Layer Foundation
1. ✅ Create service interfaces (`interfaces.go`)
2. ✅ Implement individual services
3. ✅ Create ServiceContainer for dependency injection
4. ✅ Add basic service unit tests

### Phase 2: Handler Refactoring
1. ✅ Update main.go to initialize ServiceContainer
2. ✅ Refactor handlers to use services instead of direct DB access
3. ✅ Remove all `models.` function calls from handlers
4. ✅ Remove global `DB` variable usage

### Phase 3: Testing Updates
1. ✅ Generate service mocks
2. ✅ Update handler tests to use service mocks
3. ✅ Create comprehensive service layer tests
4. ✅ Ensure test coverage matches current levels

### Phase 4: Cleanup & Validation
1. ✅ Remove unused model exports
2. ✅ Validate all handlers use services only
3. ✅ Run full test suite
4. ✅ Test e2e scenarios

## Benefits

### Separation of Concerns
- **Handlers**: Focus solely on HTTP request/response handling
- **Services**: Handle business logic and data operations
- **Models**: Define data structures and simple operations

### Improved Testability
- **Service Layer**: Unit test business logic with mocked database
- **Handler Layer**: Unit test HTTP logic with mocked services
- **Faster Tests**: No database setup required for most tests
- **Better Isolation**: Test individual components independently

### Enhanced Maintainability
- **Single Source**: Database schema changes affect only services
- **Consistent Patterns**: Standardized error handling and logging
- **Clear Boundaries**: Well-defined interfaces between layers
- **Type Safety**: Compile-time dependency validation

### Scalability Preparation
- **Interface-Based**: Easy to swap implementations
- **Caching Layer**: Can add caching between service and model
- **Multiple Databases**: Services can orchestrate multiple data sources
- **Microservices**: Services can be extracted to separate processes

## Migration Strategy

### Backward Compatibility
- No backward compatibility required per user preference
- Complete refactor acceptable
- Focus on clean, maintainable end result

### Testing Strategy
- Create service mocks before refactoring handlers
- Test each handler refactor individually
- Maintain e2e test coverage throughout migration
- Run full test suite after each major change

### Risk Mitigation
- Implement services incrementally
- Test thoroughly at each step
- Keep model functions as fallback during development
- Use interface-based design for easy swapping

## Implementation Details

### Error Handling
```go
// Consistent error wrapping in services
func (s *mealService) GetMealsByIDs(ids []int) ([]*models.Meal, error) {
    meals, err := models.GetMealsByIDs(s.db, ids)
    if err != nil {
        return nil, fmt.Errorf("failed to get meals by IDs %v: %w", ids, err)
    }
    return meals, nil
}
```

### Logging Pattern
```go
// Structured logging in services
func (s *mealService) CreateMeal(meal models.Meal) (*models.Meal, error) {
    log.Printf("Creating meal: %s", meal.MealName)
    result, err := models.CreateMeal(s.db, meal)
    if err != nil {
        log.Printf("Failed to create meal %s: %v", meal.MealName, err)
        return nil, fmt.Errorf("failed to create meal: %w", err)
    }
    log.Printf("Successfully created meal: %s (ID: %d)", result.MealName, result.ID)
    return result, nil
}
```

### Transaction Support
```go
// Transaction support for multi-table operations
type TransactionalService interface {
    WithTransaction(fn func(tx *sql.Tx) error) error
}
```

This architecture provides a solid foundation for maintainable, testable, and scalable meal planning application backend.