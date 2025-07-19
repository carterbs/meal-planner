package repositories

import (
	"context"
	"database/sql"

	"mealplanner/models"
)

// MealRepositoryImpl implements MealRepository using the existing models layer
type MealRepositoryImpl struct {
	db *sql.DB
}

// NewMealRepository creates a new MealRepositoryImpl
func NewMealRepository(db *sql.DB) *MealRepositoryImpl {
	return &MealRepositoryImpl{db: db}
}

// GetAllMeals retrieves all meals with their ingredients
func (r *MealRepositoryImpl) GetAllMeals(ctx context.Context) ([]*models.Meal, error) {
	return models.GetAllMeals(r.db)
}

// GetMealsByIDs retrieves meals by their IDs
func (r *MealRepositoryImpl) GetMealsByIDs(ctx context.Context, ids []int) ([]*models.Meal, error) {
	return models.GetMealsByIDs(r.db, ids)
}

// GetMealByID retrieves a single meal by ID
func (r *MealRepositoryImpl) GetMealByID(ctx context.Context, id int) (*models.Meal, error) {
	meals, err := models.GetMealsByIDs(r.db, []int{id})
	if err != nil {
		return nil, err
	}
	if len(meals) == 0 {
		return nil, sql.ErrNoRows
	}
	return meals[0], nil
}

// CreateMeal creates a new meal
func (r *MealRepositoryImpl) CreateMeal(ctx context.Context, meal *models.Meal) (*models.Meal, error) {
	return models.CreateMeal(r.db, meal)
}

// UpdateMeal updates an existing meal (not implemented in models)
func (r *MealRepositoryImpl) UpdateMeal(ctx context.Context, meal *models.Meal) error {
	// TODO: Implement when needed
	return nil
}

// DeleteMeal deletes a meal and its related data
func (r *MealRepositoryImpl) DeleteMeal(ctx context.Context, id int) error {
	return models.DeleteMeal(r.db, id)
}

// SwapMeal swaps a meal with a random alternative of the same type
func (r *MealRepositoryImpl) SwapMeal(ctx context.Context, mealID int, mealType string) (*models.Meal, error) {
	return models.SwapMeal(mealID, mealType, r.db)
}

// UpdateLastPlannedDates updates the last planned dates for meals
func (r *MealRepositoryImpl) UpdateLastPlannedDates(ctx context.Context, mealIDs []int) error {
	return models.UpdateLastPlannedDates(r.db, mealIDs)
}

// GetLastPlannedMeals retrieves the last planned meals
func (r *MealRepositoryImpl) GetLastPlannedMeals(ctx context.Context) (*models.WeeklyMealPlan, error) {
	return models.GetLastPlannedMeals(r.db)
}

// GenerateWeeklyMealPlan generates a new weekly meal plan
func (r *MealRepositoryImpl) GenerateWeeklyMealPlan(ctx context.Context) (*models.WeeklyMealPlan, error) {
	return models.GenerateWeeklyMealPlan(r.db)
}