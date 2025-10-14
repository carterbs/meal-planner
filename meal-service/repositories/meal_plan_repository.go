package repositories

import (
	"context"
	"database/sql"
	"fmt"
	"time"

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

// UpdateMealPlanVersion updates the version of a meal plan with a transaction
func (r *MealPlanRepositoryImpl) UpdateMealPlanVersion(ctx context.Context, id int, version int) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	if err := models.UpdateMealPlanVersion(ctx, tx, id, version); err != nil {
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

// GenerateMealPlanItems delegates to the models layer to build snapshot items.
func (r *MealPlanRepositoryImpl) GenerateMealPlanItems(ctx context.Context) ([]*models.MealPlanItem, error) {
	return models.GenerateMealPlanItems(r.db)
}
