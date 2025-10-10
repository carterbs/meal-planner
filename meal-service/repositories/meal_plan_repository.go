package repositories

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	apipb "mealplanner/generated/go"
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

// New first-class meal plan CRUD operations

// InsertMealPlan creates a new meal plan with a transaction
func (r *MealPlanRepositoryImpl) InsertMealPlan(ctx context.Context, weekStart, weekEnd time.Time, status models.MealPlanStatus, threadID *string) (int, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	id, err := models.InsertMealPlan(ctx, tx, weekStart, weekEnd, status, threadID)
	if err != nil {
		return 0, err
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return id, nil
}

// GetMealPlanByID retrieves a complete meal plan with its items
func (r *MealPlanRepositoryImpl) GetMealPlanByID(ctx context.Context, id int) (*models.MealPlan, error) {
	return models.GetMealPlanByID(ctx, r.db, id)
}

// GetMealPlanByWeek retrieves a meal plan for a specific week
func (r *MealPlanRepositoryImpl) GetMealPlanByWeek(ctx context.Context, weekStart time.Time) (*models.MealPlan, error) {
	return models.GetMealPlanByWeek(ctx, r.db, weekStart)
}

// ListMealPlansInRange retrieves meal plan summaries for a date range
func (r *MealPlanRepositoryImpl) ListMealPlansInRange(ctx context.Context, start, end time.Time, status *models.MealPlanStatus) ([]*models.MealPlanSummary, error) {
	return models.ListMealPlansInRange(ctx, r.db, start, end, status)
}

// UpdateMealPlanStatus updates the status of a meal plan with a transaction
func (r *MealPlanRepositoryImpl) UpdateMealPlanStatus(ctx context.Context, id int, status models.MealPlanStatus) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	if err := models.UpdateMealPlanStatus(ctx, tx, id, status); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// UpsertMealPlanItems inserts or updates meal plan items with a transaction
func (r *MealPlanRepositoryImpl) UpsertMealPlanItems(ctx context.Context, mealPlanID int, items []*models.MealPlanItem) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	if err := models.UpsertMealPlanItems(ctx, tx, mealPlanID, items); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// Legacy meal plan operations (for backward compatibility)

// GetLatestMealPlan retrieves the latest meal plan for a thread
func (r *MealPlanRepositoryImpl) GetLatestMealPlan(ctx context.Context, threadID string) (*models.MealPlanIdentifier, error) {
	return models.GetLatestMealPlan(r.db, threadID)
}

// GetMealPlanItems retrieves meal plan entries for a specific meal plan
func (r *MealPlanRepositoryImpl) GetMealPlanItems(ctx context.Context, mealPlanID int) ([]models.MealPlanEntry, error) {
	return models.GetMealPlanItems(r.db, mealPlanID)
}

// RemoveMealFromPlan removes a meal from a specific plan slot
func (r *MealPlanRepositoryImpl) RemoveMealFromPlan(ctx context.Context, plan *apipb.WeeklyMealPlan, dayIndex int, mealType string) error {
	return models.RemoveMealFromPlan(plan, dayIndex, mealType)
}

// GenerateWeeklyMealPlan delegates to models layer
func (r *MealPlanRepositoryImpl) GenerateWeeklyMealPlan(ctx context.Context) (*apipb.WeeklyMealPlan, error) {
	return models.GenerateWeeklyMealPlan(r.db)
}

// GetLastPlannedMeals delegates to models layer
func (r *MealPlanRepositoryImpl) GetLastPlannedMeals(ctx context.Context) (*apipb.WeeklyMealPlan, error) {
	return models.GetLastPlannedMeals(r.db)
}

// PopulateMealDetails populates meal objects inside the plan with full details
func (r *MealPlanRepositoryImpl) PopulateMealDetails(ctx context.Context, plan *apipb.WeeklyMealPlan) (*apipb.WeeklyMealPlan, error) {
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
