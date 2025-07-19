package repositories

import (
	"context"
	"database/sql"
	"fmt"

	"mealplanner/models"
)

// MealPlanRepositoryImpl implements MealPlanRepository using the existing models layer
type MealPlanRepositoryImpl struct {
	db *sql.DB
}

// NewMealPlanRepository creates a new MealPlanRepositoryImpl
func NewMealPlanRepository(db *sql.DB) *MealPlanRepositoryImpl {
	return &MealPlanRepositoryImpl{db: db}
}

// GetLatestMealPlan retrieves the latest meal plan for a thread
func (r *MealPlanRepositoryImpl) GetLatestMealPlan(ctx context.Context, threadID string) (*models.MealPlanIdentifier, error) {
	return models.GetLatestMealPlan(r.db, threadID)
}

// GetMealPlanItems retrieves meal plan entries for a specific meal plan
func (r *MealPlanRepositoryImpl) GetMealPlanItems(ctx context.Context, mealPlanID int) ([]models.MealPlanEntry, error) {
	return models.GetMealPlanItems(r.db, mealPlanID)
}

// SaveMealPlan saves a meal plan to the database
func (r *MealPlanRepositoryImpl) SaveMealPlan(ctx context.Context, threadID string, version int, entries []models.MealPlanEntry) (*models.MealPlanIdentifier, error) {
	return models.SaveMealPlan(r.db, threadID, version, entries)
}

// RemoveMealFromPlan removes a meal from a specific plan slot
func (r *MealPlanRepositoryImpl) RemoveMealFromPlan(ctx context.Context, plan *models.WeeklyMealPlan, dayIndex int, mealType string) error {
	return models.RemoveMealFromPlan(plan, dayIndex, mealType)
}

// GenerateWeeklyMealPlan delegates to models layer
func (r *MealPlanRepositoryImpl) GenerateWeeklyMealPlan(ctx context.Context) (*models.WeeklyMealPlan, error) {
	return models.GenerateWeeklyMealPlan(r.db)
}

// GetLastPlannedMeals delegates to models layer
func (r *MealPlanRepositoryImpl) GetLastPlannedMeals(ctx context.Context) (*models.WeeklyMealPlan, error) {
	return models.GetLastPlannedMeals(r.db)
}

// PopulateMealDetails populates meal objects inside the plan with full details
func (r *MealPlanRepositoryImpl) PopulateMealDetails(ctx context.Context, plan *models.WeeklyMealPlan) (*models.WeeklyMealPlan, error) {
	if plan == nil {
		return nil, fmt.Errorf("plan is nil")
	}

	// Gather meal IDs
	mealIDs := make([]int, 0)
	for _, d := range plan.Days {
		if d.Meal != nil && int(d.Meal.GetId()) != 0 {
			mealIDs = append(mealIDs, int(d.Meal.GetId()))
		}
	}
	if len(mealIDs) == 0 {
		return plan, nil
	}

	mealsWithIngredients, err := models.GetMealsByIDs(r.db, mealIDs)
	if err != nil {
		return nil, err
	}
	mealMap := make(map[int]*models.Meal, len(mealsWithIngredients))
	for _, m := range mealsWithIngredients {
		mealMap[int(m.GetId())] = m
	}

	// Clone plan
	populated := *plan
	populated.Days = make([]*models.PlanDay, len(plan.Days))
	copy(populated.Days, plan.Days)

	for _, d := range populated.Days {
		if d.Meal != nil {
			if full, ok := mealMap[int(d.Meal.GetId())]; ok {
				d.Meal = full
			}
		}
	}
	return &populated, nil
}
