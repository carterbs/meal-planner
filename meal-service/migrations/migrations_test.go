//go:build integration
// +build integration

package migrations

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"mealplanner/testutil"
)

func TestMigration009_TablesCreated(t *testing.T) {
	harness := testutil.SetupTestDB(t)

	// Run migration
	err := harness.RunMigrations()
	require.NoError(t, err, "Migration should execute successfully")

	// Verify meal_plans table exists
	err = harness.AssertTableExists("meal_plans")
	assert.NoError(t, err, "meal_plans table should exist")

	// Verify meal_plan_items table exists
	err = harness.AssertTableExists("meal_plan_items")
	assert.NoError(t, err, "meal_plan_items table should exist")
}

func TestMigration009_EnumsCreated(t *testing.T) {
	harness := testutil.SetupTestDB(t)

	err := harness.RunMigrations()
	require.NoError(t, err)

	// Verify meal_plan_status enum exists
	err = harness.AssertEnumExists("meal_plan_status")
	assert.NoError(t, err, "meal_plan_status enum should exist")

	// Verify meal_slot enum exists
	err = harness.AssertEnumExists("meal_slot")
	assert.NoError(t, err, "meal_slot enum should exist")
}

func TestMigration009_IndexesCreated(t *testing.T) {
	harness := testutil.SetupTestDB(t)

	err := harness.RunMigrations()
	require.NoError(t, err)

	indexes := []string{
		"idx_meal_plans_status_week",
		"idx_meal_plans_week_range",
		"idx_meal_plans_thread_id",
		"idx_meal_plan_items_meal_id",
		"idx_meal_plan_items_plan_day",
	}

	for _, indexName := range indexes {
		err = harness.AssertIndexExists(indexName)
		assert.NoError(t, err, "Index %s should exist", indexName)
	}
}

func TestMigration009_TriggersCreated(t *testing.T) {
	harness := testutil.SetupTestDB(t)

	err := harness.RunMigrations()
	require.NoError(t, err)

	// Verify updated_at triggers exist
	err = harness.AssertTriggerExists("update_meal_plans_updated_at")
	assert.NoError(t, err, "meal_plans trigger should exist")

	err = harness.AssertTriggerExists("update_meal_plan_items_updated_at")
	assert.NoError(t, err, "meal_plan_items trigger should exist")
}

func TestMigration009_MealPlansSchema(t *testing.T) {
	harness := testutil.SetupTestDB(t)

	err := harness.RunMigrations()
	require.NoError(t, err)

	// Test inserting a meal plan to verify schema
	ctx := context.Background()
	now := time.Now().UTC()
	weekStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)

	query := `
		INSERT INTO meal_plans (week_start_date, week_end_date, status, version)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at
	`

	var id int
	var createdAt, updatedAt time.Time
	err = harness.DB.QueryRowContext(ctx, query, weekStart, weekEnd, "draft", 1).Scan(&id, &createdAt, &updatedAt)

	assert.NoError(t, err, "Should be able to insert meal plan")
	assert.Greater(t, id, 0, "Should return a valid ID")
	assert.False(t, createdAt.IsZero(), "created_at should be set")
	assert.False(t, updatedAt.IsZero(), "updated_at should be set")
}

func TestMigration009_UniqueWeekBoundaries(t *testing.T) {
	harness := testutil.SetupTestDB(t)

	err := harness.RunMigrations()
	require.NoError(t, err)
	defer harness.CleanupTables()

	ctx := context.Background()
	weekStart := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC) // Monday
	weekEnd := weekStart.AddDate(0, 0, 6)

	// Insert first meal plan
	query := `
		INSERT INTO meal_plans (week_start_date, week_end_date, status, version)
		VALUES ($1, $2, $3, $4)
	`
	_, err = harness.DB.ExecContext(ctx, query, weekStart, weekEnd, "draft", 1)
	require.NoError(t, err, "First insert should succeed")

	// Try to insert duplicate week boundaries
	_, err = harness.DB.ExecContext(ctx, query, weekStart, weekEnd, "draft", 2)
	assert.Error(t, err, "Duplicate week boundaries should violate unique constraint")
	assert.Contains(t, err.Error(), "unique_week_boundaries", "Error should mention constraint name")
}

func TestMigration009_MealPlanItemsSchema(t *testing.T) {
	harness := testutil.SetupTestDB(t)

	err := harness.RunMigrations()
	require.NoError(t, err)
	defer harness.CleanupTables()

	ctx := context.Background()

	// First create a meal plan
	weekStart := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)

	var mealPlanID int
	err = harness.DB.QueryRowContext(ctx, `
		INSERT INTO meal_plans (week_start_date, week_end_date, status, version)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, weekStart, weekEnd, "draft", 1).Scan(&mealPlanID)
	require.NoError(t, err)

	// Insert a meal plan item
	mealSnapshot := `{"name": "Spaghetti", "meal_type": "dinner", "effort": 3}`
	query := `
		INSERT INTO meal_plan_items (meal_plan_id, day_index, meal_type, meal_snapshot)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at
	`

	var itemID int
	var createdAt, updatedAt time.Time
	err = harness.DB.QueryRowContext(ctx, query, mealPlanID, 0, "dinner", mealSnapshot).Scan(&itemID, &createdAt, &updatedAt)

	assert.NoError(t, err, "Should be able to insert meal plan item")
	assert.Greater(t, itemID, 0, "Should return a valid item ID")
	assert.False(t, createdAt.IsZero(), "created_at should be set")
	assert.False(t, updatedAt.IsZero(), "updated_at should be set")
}

func TestMigration009_UniqueMealSlotConstraint(t *testing.T) {
	harness := testutil.SetupTestDB(t)

	err := harness.RunMigrations()
	require.NoError(t, err)
	defer harness.CleanupTables()

	ctx := context.Background()

	// Create a meal plan
	weekStart := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)

	var mealPlanID int
	err = harness.DB.QueryRowContext(ctx, `
		INSERT INTO meal_plans (week_start_date, week_end_date, status, version)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, weekStart, weekEnd, "draft", 1).Scan(&mealPlanID)
	require.NoError(t, err)

	mealSnapshot := `{"name": "Test Meal", "meal_type": "dinner", "effort": 2}`

	// Insert first item for Monday dinner
	_, err = harness.DB.ExecContext(ctx, `
		INSERT INTO meal_plan_items (meal_plan_id, day_index, meal_type, meal_snapshot)
		VALUES ($1, $2, $3, $4)
	`, mealPlanID, 0, "dinner", mealSnapshot)
	require.NoError(t, err, "First insert should succeed")

	// Try to insert duplicate slot (same plan, day, and meal type)
	_, err = harness.DB.ExecContext(ctx, `
		INSERT INTO meal_plan_items (meal_plan_id, day_index, meal_type, meal_snapshot)
		VALUES ($1, $2, $3, $4)
	`, mealPlanID, 0, "dinner", mealSnapshot)
	assert.Error(t, err, "Duplicate slot should violate unique constraint")
	assert.Contains(t, err.Error(), "unique_meal_slot", "Error should mention constraint name")
}

func TestMigration009_DayIndexConstraint(t *testing.T) {
	harness := testutil.SetupTestDB(t)

	err := harness.RunMigrations()
	require.NoError(t, err)
	defer harness.CleanupTables()

	ctx := context.Background()

	// Create a meal plan
	weekStart := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)

	var mealPlanID int
	err = harness.DB.QueryRowContext(ctx, `
		INSERT INTO meal_plans (week_start_date, week_end_date, status, version)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, weekStart, weekEnd, "draft", 1).Scan(&mealPlanID)
	require.NoError(t, err)

	mealSnapshot := `{"name": "Test Meal", "meal_type": "dinner", "effort": 2}`

	// Test valid day_index values (0-6)
	for dayIndex := 0; dayIndex <= 6; dayIndex++ {
		_, err = harness.DB.ExecContext(ctx, `
			INSERT INTO meal_plan_items (meal_plan_id, day_index, meal_type, meal_snapshot)
			VALUES ($1, $2, $3, $4)
		`, mealPlanID, dayIndex, "breakfast", mealSnapshot)
		assert.NoError(t, err, "day_index %d should be valid", dayIndex)
	}

	// Test invalid day_index values
	invalidDayIndexes := []int{-1, 7, 10}
	for _, dayIndex := range invalidDayIndexes {
		_, err = harness.DB.ExecContext(ctx, `
			INSERT INTO meal_plan_items (meal_plan_id, day_index, meal_type, meal_snapshot)
			VALUES ($1, $2, $3, $4)
		`, mealPlanID, dayIndex, "lunch", mealSnapshot)
		assert.Error(t, err, "day_index %d should be invalid", dayIndex)
	}
}

func TestMigration009_CascadeDelete(t *testing.T) {
	harness := testutil.SetupTestDB(t)

	err := harness.RunMigrations()
	require.NoError(t, err)
	defer harness.CleanupTables()

	ctx := context.Background()

	// Create a meal plan with items
	weekStart := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)

	var mealPlanID int
	err = harness.DB.QueryRowContext(ctx, `
		INSERT INTO meal_plans (week_start_date, week_end_date, status, version)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, weekStart, weekEnd, "draft", 1).Scan(&mealPlanID)
	require.NoError(t, err)

	mealSnapshot := `{"name": "Test Meal", "meal_type": "dinner", "effort": 2}`

	// Insert multiple items
	for i := 0; i < 3; i++ {
		_, err = harness.DB.ExecContext(ctx, `
			INSERT INTO meal_plan_items (meal_plan_id, day_index, meal_type, meal_snapshot)
			VALUES ($1, $2, $3, $4)
		`, mealPlanID, i, "dinner", mealSnapshot)
		require.NoError(t, err)
	}

	// Verify items exist
	var itemCount int
	err = harness.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM meal_plan_items WHERE meal_plan_id = $1", mealPlanID).Scan(&itemCount)
	require.NoError(t, err)
	assert.Equal(t, 3, itemCount, "Should have 3 items")

	// Delete the meal plan
	_, err = harness.DB.ExecContext(ctx, "DELETE FROM meal_plans WHERE id = $1", mealPlanID)
	require.NoError(t, err)

	// Verify items were cascaded deleted
	err = harness.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM meal_plan_items WHERE meal_plan_id = $1", mealPlanID).Scan(&itemCount)
	require.NoError(t, err)
	assert.Equal(t, 0, itemCount, "Items should be cascade deleted")
}

func TestMigration009_UpdatedAtTrigger_MealPlans(t *testing.T) {
	harness := testutil.SetupTestDB(t)

	err := harness.RunMigrations()
	require.NoError(t, err)
	defer harness.CleanupTables()

	ctx := context.Background()

	// Insert a meal plan
	weekStart := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)

	var mealPlanID int
	var createdAt, initialUpdatedAt time.Time
	err = harness.DB.QueryRowContext(ctx, `
		INSERT INTO meal_plans (week_start_date, week_end_date, status, version)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at
	`, weekStart, weekEnd, "draft", 1).Scan(&mealPlanID, &createdAt, &initialUpdatedAt)
	require.NoError(t, err)

	// Wait a moment to ensure time difference
	time.Sleep(10 * time.Millisecond)

	// Update the meal plan
	_, err = harness.DB.ExecContext(ctx, "UPDATE meal_plans SET status = $1 WHERE id = $2", "finalized", mealPlanID)
	require.NoError(t, err)

	// Check that updated_at was modified
	var newUpdatedAt time.Time
	err = harness.DB.QueryRowContext(ctx, "SELECT updated_at FROM meal_plans WHERE id = $1", mealPlanID).Scan(&newUpdatedAt)
	require.NoError(t, err)

	assert.True(t, newUpdatedAt.After(initialUpdatedAt), "updated_at should be newer after update")
}

func TestMigration009_UpdatedAtTrigger_MealPlanItems(t *testing.T) {
	harness := testutil.SetupTestDB(t)

	err := harness.RunMigrations()
	require.NoError(t, err)
	defer harness.CleanupTables()

	ctx := context.Background()

	// Create a meal plan
	weekStart := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)

	var mealPlanID int
	err = harness.DB.QueryRowContext(ctx, `
		INSERT INTO meal_plans (week_start_date, week_end_date, status, version)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, weekStart, weekEnd, "draft", 1).Scan(&mealPlanID)
	require.NoError(t, err)

	// Insert an item
	mealSnapshot := `{"name": "Test Meal", "meal_type": "dinner", "effort": 2}`
	var itemID int
	var initialUpdatedAt time.Time
	err = harness.DB.QueryRowContext(ctx, `
		INSERT INTO meal_plan_items (meal_plan_id, day_index, meal_type, meal_snapshot)
		VALUES ($1, $2, $3, $4)
		RETURNING id, updated_at
	`, mealPlanID, 0, "dinner", mealSnapshot).Scan(&itemID, &initialUpdatedAt)
	require.NoError(t, err)

	// Wait a moment to ensure time difference
	time.Sleep(10 * time.Millisecond)

	// Update the item
	newSnapshot := `{"name": "Updated Meal", "meal_type": "dinner", "effort": 3}`
	_, err = harness.DB.ExecContext(ctx, "UPDATE meal_plan_items SET meal_snapshot = $1 WHERE id = $2", newSnapshot, itemID)
	require.NoError(t, err)

	// Check that updated_at was modified
	var newUpdatedAt time.Time
	err = harness.DB.QueryRowContext(ctx, "SELECT updated_at FROM meal_plan_items WHERE id = $1", itemID).Scan(&newUpdatedAt)
	require.NoError(t, err)

	assert.True(t, newUpdatedAt.After(initialUpdatedAt), "updated_at should be newer after update")
}

func TestMigration009_MealPlanStatusEnum_Values(t *testing.T) {
	harness := testutil.SetupTestDB(t)

	err := harness.RunMigrations()
	require.NoError(t, err)
	defer harness.CleanupTables()

	ctx := context.Background()
	weekStart := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)

	// Test all valid enum values
	validStatuses := []string{"draft", "finalized", "archived", "abandoned"}

	for _, status := range validStatuses {
		var id int
		err = harness.DB.QueryRowContext(ctx, `
			INSERT INTO meal_plans (week_start_date, week_end_date, status, version)
			VALUES ($1, $2, $3, $4)
			RETURNING id
		`, weekStart.Add(time.Duration(len(validStatuses))*24*time.Hour), weekEnd.Add(time.Duration(len(validStatuses))*24*time.Hour), status, 1).Scan(&id)
		assert.NoError(t, err, "Status '%s' should be valid", status)
	}

	// Test invalid enum value
	_, err = harness.DB.ExecContext(ctx, `
		INSERT INTO meal_plans (week_start_date, week_end_date, status, version)
		VALUES ($1, $2, $3, $4)
	`, weekStart, weekEnd, "invalid_status", 1)
	assert.Error(t, err, "Invalid status should fail")
}

func TestMigration009_MealSlotEnum_Values(t *testing.T) {
	harness := testutil.SetupTestDB(t)

	err := harness.RunMigrations()
	require.NoError(t, err)
	defer harness.CleanupTables()

	ctx := context.Background()

	// Create a meal plan
	weekStart := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)

	var mealPlanID int
	err = harness.DB.QueryRowContext(ctx, `
		INSERT INTO meal_plans (week_start_date, week_end_date, status, version)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, weekStart, weekEnd, "draft", 1).Scan(&mealPlanID)
	require.NoError(t, err)

	mealSnapshot := `{"name": "Test Meal", "meal_type": "dinner", "effort": 2}`

	// Test all valid meal slot values
	validSlots := []string{"breakfast", "lunch", "dinner"}

	for i, slot := range validSlots {
		var id int
		err = harness.DB.QueryRowContext(ctx, `
			INSERT INTO meal_plan_items (meal_plan_id, day_index, meal_type, meal_snapshot)
			VALUES ($1, $2, $3, $4)
			RETURNING id
		`, mealPlanID, i, slot, mealSnapshot).Scan(&id)
		assert.NoError(t, err, "Meal slot '%s' should be valid", slot)
	}

	// Test invalid meal slot value
	_, err = harness.DB.ExecContext(ctx, `
		INSERT INTO meal_plan_items (meal_plan_id, day_index, meal_type, meal_snapshot)
		VALUES ($1, $2, $3, $4)
	`, mealPlanID, 3, "invalid_slot", mealSnapshot)
	assert.Error(t, err, "Invalid meal slot should fail")
}
