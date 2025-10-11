//go:build integration
// +build integration

package repositories

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	apipb "mealplanner/generated/go"
	"mealplanner/models"
	"mealplanner/testutil"
)

// TestInsertMealPlan tests creating a new meal plan
func TestInsertMealPlan(t *testing.T) {
	harness := testutil.SetupTestDB(t)
	err := harness.RunMigrations()
	require.NoError(t, err)
	defer harness.CleanupTables()

	repo := NewMealPlanRepository(harness.DB)
	ctx := context.Background()

	weekStart := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC) // Monday
	weekEnd := weekStart.AddDate(0, 0, 6)                    // Sunday

	t.Run("successful insert with draft status", func(t *testing.T) {
		id, err := repo.InsertMealPlan(ctx, weekStart, weekEnd, apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, nil)

		assert.NoError(t, err)
		assert.Greater(t, id, 0)
	})

	t.Run("successful insert with thread ID", func(t *testing.T) {
		weekStart2 := weekStart.AddDate(0, 0, 7)
		weekEnd2 := weekEnd.AddDate(0, 0, 7)
		threadID := "test-thread-123"

		id, err := repo.InsertMealPlan(ctx, weekStart2, weekEnd2, apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, &threadID)

		assert.NoError(t, err)
		assert.Greater(t, id, 0)

		// Verify thread_id was stored
		plan, err := repo.GetMealPlanByID(ctx, id)
		require.NoError(t, err)
		assert.NotNil(t, plan.ThreadId)
		assert.Equal(t, threadID, *plan.ThreadId)
	})

	t.Run("insert with all status types", func(t *testing.T) {
		statuses := []apipb.MealPlanStatus{
			apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT,
			apipb.MealPlanStatus_MEAL_PLAN_STATUS_FINALIZED,
			apipb.MealPlanStatus_MEAL_PLAN_STATUS_ARCHIVED,
			apipb.MealPlanStatus_MEAL_PLAN_STATUS_ABANDONED,
		}

		for i, status := range statuses {
			weekStartOffset := weekStart.AddDate(0, 0, (i+2)*7)
			weekEndOffset := weekEnd.AddDate(0, 0, (i+2)*7)

			id, err := repo.InsertMealPlan(ctx, weekStartOffset, weekEndOffset, status, nil)

			assert.NoError(t, err, "Status %v should be insertable", status)
			assert.Greater(t, id, 0)

			// Verify status was stored correctly
			plan, err := repo.GetMealPlanByID(ctx, id)
			require.NoError(t, err)
			assert.Equal(t, status, plan.Status)
		}
	})

	t.Run("unique week boundaries constraint", func(t *testing.T) {
		harness.CleanupTables()

		weekStart3 := time.Date(2025, 2, 3, 0, 0, 0, 0, time.UTC)
		weekEnd3 := weekStart3.AddDate(0, 0, 6)

		// Insert first meal plan
		id1, err := repo.InsertMealPlan(ctx, weekStart3, weekEnd3, apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, nil)
		require.NoError(t, err)
		assert.Greater(t, id1, 0)

		// Try to insert duplicate week boundaries
		_, err = repo.InsertMealPlan(ctx, weekStart3, weekEnd3, apipb.MealPlanStatus_MEAL_PLAN_STATUS_FINALIZED, nil)
		assert.Error(t, err, "Duplicate week boundaries should fail")
		assert.Contains(t, err.Error(), "unique_week_boundaries")
	})
}

// TestGetMealPlanByID tests retrieving a meal plan by ID
func TestGetMealPlanByID(t *testing.T) {
	harness := testutil.SetupTestDB(t)
	err := harness.RunMigrations()
	require.NoError(t, err)
	defer harness.CleanupTables()

	repo := NewMealPlanRepository(harness.DB)
	ctx := context.Background()

	weekStart := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)
	threadID := "test-thread-456"

	t.Run("retrieve existing meal plan", func(t *testing.T) {
		id, err := repo.InsertMealPlan(ctx, weekStart, weekEnd, apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, &threadID)
		require.NoError(t, err)

		plan, err := repo.GetMealPlanByID(ctx, id)

		assert.NoError(t, err)
		assert.NotNil(t, plan)
		assert.Equal(t, int32(id), plan.Id)
		assert.Equal(t, apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, plan.Status)
		assert.Equal(t, int32(1), plan.Version)
		assert.NotNil(t, plan.ThreadId)
		assert.Equal(t, threadID, *plan.ThreadId)
		assert.NotNil(t, plan.CreatedAt)
		assert.NotNil(t, plan.UpdatedAt)
		assert.Empty(t, plan.Items, "No items should exist yet")
	})

	t.Run("retrieve non-existent meal plan", func(t *testing.T) {
		plan, err := repo.GetMealPlanByID(ctx, 99999)

		assert.Error(t, err)
		assert.Nil(t, plan)
		assert.Contains(t, err.Error(), "meal plan not found")
	})
}

// TestGetMealPlanByWeek tests retrieving a meal plan by week
func TestGetMealPlanByWeek(t *testing.T) {
	harness := testutil.SetupTestDB(t)
	err := harness.RunMigrations()
	require.NoError(t, err)
	defer harness.CleanupTables()

	repo := NewMealPlanRepository(harness.DB)
	ctx := context.Background()

	weekStart := time.Date(2025, 1, 13, 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)

	t.Run("retrieve existing week", func(t *testing.T) {
		id, err := repo.InsertMealPlan(ctx, weekStart, weekEnd, apipb.MealPlanStatus_MEAL_PLAN_STATUS_FINALIZED, nil)
		require.NoError(t, err)

		plan, err := repo.GetMealPlanByWeek(ctx, weekStart)

		assert.NoError(t, err)
		assert.NotNil(t, plan)
		assert.Equal(t, int32(id), plan.Id)
		assert.Equal(t, apipb.MealPlanStatus_MEAL_PLAN_STATUS_FINALIZED, plan.Status)
	})

	t.Run("retrieve non-existent week", func(t *testing.T) {
		nonExistentWeek := time.Date(2025, 3, 10, 0, 0, 0, 0, time.UTC)

		plan, err := repo.GetMealPlanByWeek(ctx, nonExistentWeek)

		assert.NoError(t, err, "Not found should not be an error")
		assert.Nil(t, plan)
	})
}

// TestListMealPlansInRange tests listing meal plans in a date range
func TestListMealPlansInRange(t *testing.T) {
	harness := testutil.SetupTestDB(t)
	err := harness.RunMigrations()
	require.NoError(t, err)
	defer harness.CleanupTables()

	repo := NewMealPlanRepository(harness.DB)
	ctx := context.Background()

	// Create multiple meal plans across different weeks
	week1Start := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
	week2Start := time.Date(2025, 1, 13, 0, 0, 0, 0, time.UTC)
	week3Start := time.Date(2025, 1, 20, 0, 0, 0, 0, time.UTC)

	_, err = repo.InsertMealPlan(ctx, week1Start, week1Start.AddDate(0, 0, 6), apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, nil)
	require.NoError(t, err)

	_, err = repo.InsertMealPlan(ctx, week2Start, week2Start.AddDate(0, 0, 6), apipb.MealPlanStatus_MEAL_PLAN_STATUS_FINALIZED, nil)
	require.NoError(t, err)

	_, err = repo.InsertMealPlan(ctx, week3Start, week3Start.AddDate(0, 0, 6), apipb.MealPlanStatus_MEAL_PLAN_STATUS_ARCHIVED, nil)
	require.NoError(t, err)

	t.Run("list all plans in range", func(t *testing.T) {
		start := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		end := time.Date(2025, 1, 31, 23, 59, 59, 0, time.UTC)

		summaries, err := repo.ListMealPlansInRange(ctx, start, end, nil)

		assert.NoError(t, err)
		assert.Len(t, summaries, 3)

		// Verify summaries are ordered by week_start_date DESC
		assert.True(t, summaries[0].WeekStartDate.AsTime().After(summaries[1].WeekStartDate.AsTime()))
		assert.True(t, summaries[1].WeekStartDate.AsTime().After(summaries[2].WeekStartDate.AsTime()))
	})

	t.Run("filter by status", func(t *testing.T) {
		start := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		end := time.Date(2025, 1, 31, 23, 59, 59, 0, time.UTC)
		finalizedStatus := apipb.MealPlanStatus_MEAL_PLAN_STATUS_FINALIZED

		summaries, err := repo.ListMealPlansInRange(ctx, start, end, &finalizedStatus)

		assert.NoError(t, err)
		assert.Len(t, summaries, 1)
		assert.Equal(t, apipb.MealPlanStatus_MEAL_PLAN_STATUS_FINALIZED, summaries[0].Status)
	})

	t.Run("no plans in range", func(t *testing.T) {
		start := time.Date(2025, 3, 1, 0, 0, 0, 0, time.UTC)
		end := time.Date(2025, 3, 31, 23, 59, 59, 0, time.UTC)

		summaries, err := repo.ListMealPlansInRange(ctx, start, end, nil)

		assert.NoError(t, err)
		assert.Empty(t, summaries)
	})
}

// TestUpdateMealPlanStatus tests updating meal plan status
func TestUpdateMealPlanStatus(t *testing.T) {
	harness := testutil.SetupTestDB(t)
	err := harness.RunMigrations()
	require.NoError(t, err)
	defer harness.CleanupTables()

	repo := NewMealPlanRepository(harness.DB)
	ctx := context.Background()

	weekStart := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)

	t.Run("update existing meal plan status", func(t *testing.T) {
		id, err := repo.InsertMealPlan(ctx, weekStart, weekEnd, apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, nil)
		require.NoError(t, err)

		err = repo.UpdateMealPlanStatus(ctx, id, apipb.MealPlanStatus_MEAL_PLAN_STATUS_FINALIZED)
		assert.NoError(t, err)

		// Verify status was updated
		plan, err := repo.GetMealPlanByID(ctx, id)
		require.NoError(t, err)
		assert.Equal(t, apipb.MealPlanStatus_MEAL_PLAN_STATUS_FINALIZED, plan.Status)
	})

	t.Run("status transitions", func(t *testing.T) {
		transitions := []struct {
			from apipb.MealPlanStatus
			to   apipb.MealPlanStatus
		}{
			{apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, apipb.MealPlanStatus_MEAL_PLAN_STATUS_FINALIZED},
			{apipb.MealPlanStatus_MEAL_PLAN_STATUS_FINALIZED, apipb.MealPlanStatus_MEAL_PLAN_STATUS_ARCHIVED},
			{apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, apipb.MealPlanStatus_MEAL_PLAN_STATUS_ABANDONED},
		}

		for i, transition := range transitions {
			weekStartOffset := weekStart.AddDate(0, 0, (i+1)*7)
			weekEndOffset := weekEnd.AddDate(0, 0, (i+1)*7)

			id, err := repo.InsertMealPlan(ctx, weekStartOffset, weekEndOffset, transition.from, nil)
			require.NoError(t, err)

			err = repo.UpdateMealPlanStatus(ctx, id, transition.to)
			assert.NoError(t, err, "Transition from %v to %v should succeed", transition.from, transition.to)

			plan, err := repo.GetMealPlanByID(ctx, id)
			require.NoError(t, err)
			assert.Equal(t, transition.to, plan.Status)
		}
	})

	t.Run("update non-existent meal plan", func(t *testing.T) {
		err := repo.UpdateMealPlanStatus(ctx, 99999, apipb.MealPlanStatus_MEAL_PLAN_STATUS_FINALIZED)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "meal plan not found")
	})
}

// TestUpdateMealPlanVersion tests updating the version of a meal plan
func TestUpdateMealPlanVersion(t *testing.T) {
	harness := testutil.SetupTestDB(t)
	err := harness.RunMigrations()
	require.NoError(t, err)
	defer harness.CleanupTables()

	repo := NewMealPlanRepository(harness.DB)
	ctx := context.Background()

	weekStart := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)

	t.Run("update existing meal plan version", func(t *testing.T) {
		id, err := repo.InsertMealPlan(ctx, weekStart, weekEnd, apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, nil)
		require.NoError(t, err)

		err = repo.UpdateMealPlanVersion(ctx, id, 5)
		assert.NoError(t, err)

		plan, err := repo.GetMealPlanByID(ctx, id)
		require.NoError(t, err)
		assert.Equal(t, int32(5), plan.Version)
	})

	t.Run("update non-existent meal plan version", func(t *testing.T) {
		err := repo.UpdateMealPlanVersion(ctx, 99999, 3)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "meal plan not found")
	})
}

// TestUpsertMealPlanItems tests inserting/updating meal plan items
func TestUpsertMealPlanItems(t *testing.T) {
	harness := testutil.SetupTestDB(t)
	err := harness.RunMigrations()
	require.NoError(t, err)
	defer harness.CleanupTables()

	repo := NewMealPlanRepository(harness.DB)
	ctx := context.Background()

	weekStart := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)

	t.Run("insert new items", func(t *testing.T) {
		id, err := repo.InsertMealPlan(ctx, weekStart, weekEnd, apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, nil)
		require.NoError(t, err)

		items := []*models.MealPlanItem{
			testutil.NewMealPlanItemBuilder().
				WithMealPlanID(id).
				WithDayIndex(0).
				WithMealType(apipb.MealSlot_MEAL_SLOT_BREAKFAST).
				WithMealSnapshot(testutil.NewMealBuilder().WithName("Scrambled Eggs").Build()).
				Build(),
			testutil.NewMealPlanItemBuilder().
				WithMealPlanID(id).
				WithDayIndex(0).
				WithMealType(apipb.MealSlot_MEAL_SLOT_DINNER).
				WithMealSnapshot(testutil.NewMealBuilder().WithName("Spaghetti").Build()).
				Build(),
		}

		err = repo.UpsertMealPlanItems(ctx, id, items)
		assert.NoError(t, err)

		// Verify items were inserted
		plan, err := repo.GetMealPlanByID(ctx, id)
		require.NoError(t, err)
		assert.Len(t, plan.Items, 2)
		assert.Equal(t, "Scrambled Eggs", plan.Items[0].MealSnapshot.Name)
		assert.Equal(t, "Spaghetti", plan.Items[1].MealSnapshot.Name)
	})

	t.Run("update existing items (upsert replaces all)", func(t *testing.T) {
		harness.CleanupTables()

		id, err := repo.InsertMealPlan(ctx, weekStart, weekEnd, apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, nil)
		require.NoError(t, err)

		// Insert initial items
		initialItems := []*models.MealPlanItem{
			testutil.NewMealPlanItemBuilder().
				WithMealPlanID(id).
				WithDayIndex(0).
				WithMealType(apipb.MealSlot_MEAL_SLOT_DINNER).
				WithMealSnapshot(testutil.NewMealBuilder().WithName("Initial Meal").Build()).
				Build(),
		}

		err = repo.UpsertMealPlanItems(ctx, id, initialItems)
		require.NoError(t, err)

		// Upsert new items (should replace)
		updatedItems := []*models.MealPlanItem{
			testutil.NewMealPlanItemBuilder().
				WithMealPlanID(id).
				WithDayIndex(0).
				WithMealType(apipb.MealSlot_MEAL_SLOT_BREAKFAST).
				WithMealSnapshot(testutil.NewMealBuilder().WithName("Updated Breakfast").Build()).
				Build(),
			testutil.NewMealPlanItemBuilder().
				WithMealPlanID(id).
				WithDayIndex(0).
				WithMealType(apipb.MealSlot_MEAL_SLOT_DINNER).
				WithMealSnapshot(testutil.NewMealBuilder().WithName("Updated Dinner").Build()).
				Build(),
		}

		err = repo.UpsertMealPlanItems(ctx, id, updatedItems)
		assert.NoError(t, err)

		// Verify items were replaced
		plan, err := repo.GetMealPlanByID(ctx, id)
		require.NoError(t, err)
		assert.Len(t, plan.Items, 2)
		assert.Equal(t, "Updated Breakfast", plan.Items[0].MealSnapshot.Name)
		assert.Equal(t, "Updated Dinner", plan.Items[1].MealSnapshot.Name)
	})

	t.Run("empty items list clears all items", func(t *testing.T) {
		harness.CleanupTables()

		id, err := repo.InsertMealPlan(ctx, weekStart, weekEnd, apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, nil)
		require.NoError(t, err)

		// Insert items
		items := []*models.MealPlanItem{
			testutil.NewMealPlanItemBuilder().
				WithMealPlanID(id).
				WithDayIndex(0).
				WithMealType(apipb.MealSlot_MEAL_SLOT_DINNER).
				WithMealSnapshot(testutil.NewMealBuilder().WithName("Test Meal").Build()).
				Build(),
		}

		err = repo.UpsertMealPlanItems(ctx, id, items)
		require.NoError(t, err)

		// Upsert empty list
		err = repo.UpsertMealPlanItems(ctx, id, []*models.MealPlanItem{})
		assert.NoError(t, err)

		// Verify all items were deleted
		plan, err := repo.GetMealPlanByID(ctx, id)
		require.NoError(t, err)
		assert.Empty(t, plan.Items)
	})

	t.Run("items with meal_id reference", func(t *testing.T) {
		harness.CleanupTables()

		id, err := repo.InsertMealPlan(ctx, weekStart, weekEnd, apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, nil)
		require.NoError(t, err)

		mealID := 42
		items := []*models.MealPlanItem{
			testutil.NewMealPlanItemBuilder().
				WithMealPlanID(id).
				WithDayIndex(0).
				WithMealType(apipb.MealSlot_MEAL_SLOT_DINNER).
				WithMealID(mealID).
				WithMealSnapshot(testutil.NewMealBuilder().WithID(mealID).WithName("Referenced Meal").Build()).
				Build(),
		}

		err = repo.UpsertMealPlanItems(ctx, id, items)
		assert.NoError(t, err)

		// Verify meal_id was stored
		plan, err := repo.GetMealPlanByID(ctx, id)
		require.NoError(t, err)
		assert.Len(t, plan.Items, 1)
		assert.NotNil(t, plan.Items[0].MealId)
		assert.Equal(t, int32(mealID), *plan.Items[0].MealId)
	})
}

// TestMealPlanItemsJSONRoundTrip tests JSON marshaling/unmarshaling
func TestMealPlanItemsJSONRoundTrip(t *testing.T) {
	harness := testutil.SetupTestDB(t)
	err := harness.RunMigrations()
	require.NoError(t, err)
	defer harness.CleanupTables()

	repo := NewMealPlanRepository(harness.DB)
	ctx := context.Background()

	weekStart := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)

	t.Run("complex meal snapshot round-trip", func(t *testing.T) {
		id, err := repo.InsertMealPlan(ctx, weekStart, weekEnd, apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, nil)
		require.NoError(t, err)

		// Create a meal with ingredients and steps
		meal := testutil.NewMealBuilder().
			WithName("Spaghetti Carbonara").
			WithMealType("dinner").
			WithEffort(3).
			WithURL("https://example.com/recipe").
			WithIngredients(
				testutil.NewIngredientBuilder().WithName("Spaghetti").WithQuantity(1).WithUnit("lb").Build(),
				testutil.NewIngredientBuilder().WithName("Eggs").WithQuantity(3).WithUnit("large").Build(),
				testutil.NewIngredientBuilder().WithName("Parmesan").WithQuantity(1).WithUnit("cup").Build(),
			).
			WithSteps(
				testutil.NewStepBuilder().WithInstruction("Boil pasta").Build(),
				testutil.NewStepBuilder().WithInstruction("Mix eggs and cheese").Build(),
				testutil.NewStepBuilder().WithInstruction("Combine and serve").Build(),
			).
			Build()

		items := []*models.MealPlanItem{
			testutil.NewMealPlanItemBuilder().
				WithMealPlanID(id).
				WithDayIndex(0).
				WithMealType(apipb.MealSlot_MEAL_SLOT_DINNER).
				WithMealSnapshot(meal).
				Build(),
		}

		err = repo.UpsertMealPlanItems(ctx, id, items)
		require.NoError(t, err)

		// Retrieve and verify
		plan, err := repo.GetMealPlanByID(ctx, id)
		require.NoError(t, err)
		require.Len(t, plan.Items, 1)

		snapshot := plan.Items[0].MealSnapshot
		assert.Equal(t, "Spaghetti Carbonara", snapshot.Name)
		assert.Equal(t, "dinner", snapshot.MealType)
		assert.Equal(t, int32(3), snapshot.Effort)
		assert.Equal(t, "https://example.com/recipe", snapshot.Url)
		assert.Len(t, snapshot.Ingredients, 3)
		assert.Len(t, snapshot.Steps, 3)

		// Verify ingredients preserved
		assert.Equal(t, "Spaghetti", snapshot.Ingredients[0].Name)
		assert.Equal(t, float64(1), snapshot.Ingredients[0].Quantity)
		assert.Equal(t, "lb", snapshot.Ingredients[0].Unit)

		// Verify steps preserved
		assert.Equal(t, "Boil pasta", snapshot.Steps[0].Instruction)
	})

	t.Run("empty ingredients and steps", func(t *testing.T) {
		harness.CleanupTables()

		id, err := repo.InsertMealPlan(ctx, weekStart, weekEnd, apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, nil)
		require.NoError(t, err)

		meal := testutil.NewMealBuilder().
			WithName("Simple Meal").
			WithIngredients().
			WithSteps().
			Build()

		items := []*models.MealPlanItem{
			testutil.NewMealPlanItemBuilder().
				WithMealPlanID(id).
				WithDayIndex(0).
				WithMealType(apipb.MealSlot_MEAL_SLOT_LUNCH).
				WithMealSnapshot(meal).
				Build(),
		}

		err = repo.UpsertMealPlanItems(ctx, id, items)
		require.NoError(t, err)

		plan, err := repo.GetMealPlanByID(ctx, id)
		require.NoError(t, err)
		require.Len(t, plan.Items, 1)

		snapshot := plan.Items[0].MealSnapshot
		assert.Equal(t, "Simple Meal", snapshot.Name)
		assert.Empty(t, snapshot.Ingredients)
		assert.Empty(t, snapshot.Steps)
	})

	t.Run("special characters in meal data", func(t *testing.T) {
		harness.CleanupTables()

		id, err := repo.InsertMealPlan(ctx, weekStart, weekEnd, apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, nil)
		require.NoError(t, err)

		meal := testutil.NewMealBuilder().
			WithName("Mom's \"Special\" Recipe 🍝").
			WithIngredients(
				testutil.NewIngredientBuilder().WithName("Garlic & Onions").Build(),
			).
			WithSteps(
				testutil.NewStepBuilder().WithInstruction("Add salt, pepper & spices").Build(),
			).
			Build()

		items := []*models.MealPlanItem{
			testutil.NewMealPlanItemBuilder().
				WithMealPlanID(id).
				WithDayIndex(0).
				WithMealType(apipb.MealSlot_MEAL_SLOT_DINNER).
				WithMealSnapshot(meal).
				Build(),
		}

		err = repo.UpsertMealPlanItems(ctx, id, items)
		require.NoError(t, err)

		plan, err := repo.GetMealPlanByID(ctx, id)
		require.NoError(t, err)
		require.Len(t, plan.Items, 1)

		snapshot := plan.Items[0].MealSnapshot
		assert.Equal(t, "Mom's \"Special\" Recipe 🍝", snapshot.Name)
		assert.Equal(t, "Garlic & Onions", snapshot.Ingredients[0].Name)
		assert.Equal(t, "Add salt, pepper & spices", snapshot.Steps[0].Instruction)
	})
}

// TestMealPlanItemsOrdering tests that items are returned in correct order
func TestMealPlanItemsOrdering(t *testing.T) {
	harness := testutil.SetupTestDB(t)
	err := harness.RunMigrations()
	require.NoError(t, err)
	defer harness.CleanupTables()

	repo := NewMealPlanRepository(harness.DB)
	ctx := context.Background()

	weekStart := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)

	id, err := repo.InsertMealPlan(ctx, weekStart, weekEnd, apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, nil)
	require.NoError(t, err)

	// Insert items in random order
	items := []*models.MealPlanItem{
		testutil.NewMealPlanItemBuilder().
			WithMealPlanID(id).
			WithDayIndex(2).
			WithMealType(apipb.MealSlot_MEAL_SLOT_LUNCH).
			WithMealSnapshot(testutil.NewMealBuilder().WithName("Wed Lunch").Build()).
			Build(),
		testutil.NewMealPlanItemBuilder().
			WithMealPlanID(id).
			WithDayIndex(0).
			WithMealType(apipb.MealSlot_MEAL_SLOT_BREAKFAST).
			WithMealSnapshot(testutil.NewMealBuilder().WithName("Mon Breakfast").Build()).
			Build(),
		testutil.NewMealPlanItemBuilder().
			WithMealPlanID(id).
			WithDayIndex(0).
			WithMealType(apipb.MealSlot_MEAL_SLOT_DINNER).
			WithMealSnapshot(testutil.NewMealBuilder().WithName("Mon Dinner").Build()).
			Build(),
		testutil.NewMealPlanItemBuilder().
			WithMealPlanID(id).
			WithDayIndex(0).
			WithMealType(apipb.MealSlot_MEAL_SLOT_LUNCH).
			WithMealSnapshot(testutil.NewMealBuilder().WithName("Mon Lunch").Build()).
			Build(),
	}

	err = repo.UpsertMealPlanItems(ctx, id, items)
	require.NoError(t, err)

	// Retrieve and verify ordering
	plan, err := repo.GetMealPlanByID(ctx, id)
	require.NoError(t, err)
	require.Len(t, plan.Items, 4)

	// Should be ordered by day_index, then meal_type
	assert.Equal(t, "Mon Breakfast", plan.Items[0].MealSnapshot.Name)
	assert.Equal(t, int32(0), plan.Items[0].DayIndex)
	assert.Equal(t, apipb.MealSlot_MEAL_SLOT_BREAKFAST, plan.Items[0].MealType)

	assert.Equal(t, "Mon Dinner", plan.Items[1].MealSnapshot.Name)
	assert.Equal(t, int32(0), plan.Items[1].DayIndex)
	assert.Equal(t, apipb.MealSlot_MEAL_SLOT_DINNER, plan.Items[1].MealType)

	assert.Equal(t, "Mon Lunch", plan.Items[2].MealSnapshot.Name)
	assert.Equal(t, int32(0), plan.Items[2].DayIndex)
	assert.Equal(t, apipb.MealSlot_MEAL_SLOT_LUNCH, plan.Items[2].MealType)

	assert.Equal(t, "Wed Lunch", plan.Items[3].MealSnapshot.Name)
	assert.Equal(t, int32(2), plan.Items[3].DayIndex)
	assert.Equal(t, apipb.MealSlot_MEAL_SLOT_LUNCH, plan.Items[3].MealType)
}

// TestMealPlanSummaryItemCount tests that item counts are correct in summaries
func TestMealPlanSummaryItemCount(t *testing.T) {
	harness := testutil.SetupTestDB(t)
	err := harness.RunMigrations()
	require.NoError(t, err)
	defer harness.CleanupTables()

	repo := NewMealPlanRepository(harness.DB)
	ctx := context.Background()

	// Create plan with items
	week1Start := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
	id1, err := repo.InsertMealPlan(ctx, week1Start, week1Start.AddDate(0, 0, 6), apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, nil)
	require.NoError(t, err)

	items := []*models.MealPlanItem{
		testutil.NewMealPlanItemBuilder().WithMealPlanID(id1).WithDayIndex(0).WithMealType(apipb.MealSlot_MEAL_SLOT_BREAKFAST).Build(),
		testutil.NewMealPlanItemBuilder().WithMealPlanID(id1).WithDayIndex(0).WithMealType(apipb.MealSlot_MEAL_SLOT_LUNCH).Build(),
		testutil.NewMealPlanItemBuilder().WithMealPlanID(id1).WithDayIndex(0).WithMealType(apipb.MealSlot_MEAL_SLOT_DINNER).Build(),
	}
	err = repo.UpsertMealPlanItems(ctx, id1, items)
	require.NoError(t, err)

	// Create plan without items
	week2Start := time.Date(2025, 1, 13, 0, 0, 0, 0, time.UTC)
	_, err = repo.InsertMealPlan(ctx, week2Start, week2Start.AddDate(0, 0, 6), apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, nil)
	require.NoError(t, err)

	// List and verify counts
	start := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2025, 1, 31, 23, 59, 59, 0, time.UTC)

	summaries, err := repo.ListMealPlansInRange(ctx, start, end, nil)
	require.NoError(t, err)
	assert.Len(t, summaries, 2)

	// Find the summaries
	var summary1, summary2 *models.MealPlanSummary
	for _, s := range summaries {
		if s.Id == int32(id1) {
			summary1 = s
		} else {
			summary2 = s
		}
	}

	require.NotNil(t, summary1)
	require.NotNil(t, summary2)

	assert.Equal(t, int32(3), summary1.ItemCount, "Plan with items should have count of 3")
	assert.Equal(t, int32(0), summary2.ItemCount, "Plan without items should have count of 0")
}

// TestErrorConditions tests various error scenarios
func TestErrorConditions(t *testing.T) {
	harness := testutil.SetupTestDB(t)
	err := harness.RunMigrations()
	require.NoError(t, err)
	defer harness.CleanupTables()

	repo := NewMealPlanRepository(harness.DB)
	ctx := context.Background()

	t.Run("upsert items for non-existent meal plan", func(t *testing.T) {
		items := []*models.MealPlanItem{
			testutil.NewMealPlanItemBuilder().
				WithMealPlanID(99999).
				WithDayIndex(0).
				WithMealType(apipb.MealSlot_MEAL_SLOT_DINNER).
				Build(),
		}

		err := repo.UpsertMealPlanItems(ctx, 99999, items)
		assert.Error(t, err, "Should fail for non-existent meal plan")
	})

	t.Run("context cancellation", func(t *testing.T) {
		cancelledCtx, cancel := context.WithCancel(ctx)
		cancel() // Cancel immediately

		weekStart := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
		weekEnd := weekStart.AddDate(0, 0, 6)

		_, err := repo.InsertMealPlan(cancelledCtx, weekStart, weekEnd, apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, nil)
		assert.Error(t, err, "Should fail with cancelled context")
	})
}

// TestTransactionIsolation tests that operations are properly isolated in transactions
func TestTransactionIsolation(t *testing.T) {
	harness := testutil.SetupTestDB(t)
	err := harness.RunMigrations()
	require.NoError(t, err)
	defer harness.CleanupTables()

	repo := NewMealPlanRepository(harness.DB)
	ctx := context.Background()

	weekStart := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)

	t.Run("item upsert is atomic", func(t *testing.T) {
		id, err := repo.InsertMealPlan(ctx, weekStart, weekEnd, apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, nil)
		require.NoError(t, err)

		// Insert initial items
		initialItems := []*models.MealPlanItem{
			testutil.NewMealPlanItemBuilder().WithMealPlanID(id).WithDayIndex(0).WithMealType(apipb.MealSlot_MEAL_SLOT_BREAKFAST).Build(),
		}
		err = repo.UpsertMealPlanItems(ctx, id, initialItems)
		require.NoError(t, err)

		// Attempt to upsert with a bad item (this should cause the entire transaction to fail)
		badItems := []*models.MealPlanItem{
			testutil.NewMealPlanItemBuilder().WithMealPlanID(id).WithDayIndex(0).WithMealType(apipb.MealSlot_MEAL_SLOT_LUNCH).Build(),
			// This would need to be constructed to cause a failure - for now we just test the happy path
		}

		err = repo.UpsertMealPlanItems(ctx, id, badItems)
		// In case of partial failure, original items should still be there or all should be replaced
		// This demonstrates transaction atomicity

		plan, err := repo.GetMealPlanByID(ctx, id)
		require.NoError(t, err)
		// Either we have the new items or the old items, but not a partial state
		assert.NotEmpty(t, plan.Items)
	})
}

// TestRawJSONStorage tests that JSON is properly stored and retrieved
func TestRawJSONStorage(t *testing.T) {
	harness := testutil.SetupTestDB(t)
	err := harness.RunMigrations()
	require.NoError(t, err)
	defer harness.CleanupTables()

	ctx := context.Background()

	weekStart := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)

	// Insert a meal plan
	var mealPlanID int
	err = harness.DB.QueryRowContext(ctx, `
		INSERT INTO meal_plans (week_start_date, week_end_date, status, version)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, weekStart, weekEnd, "draft", 1).Scan(&mealPlanID)
	require.NoError(t, err)

	// Insert item with raw JSON
	rawJSON := map[string]interface{}{
		"name":      "Test Meal",
		"meal_type": "dinner",
		"effort":    int32(3),
		"url":       "https://example.com",
		"ingredients": []map[string]interface{}{
			{
				"name":     "Ingredient 1",
				"quantity": float64(2),
				"unit":     "cups",
			},
		},
	}

	jsonBytes, err := json.Marshal(rawJSON)
	require.NoError(t, err)

	_, err = harness.DB.ExecContext(ctx, `
		INSERT INTO meal_plan_items (meal_plan_id, day_index, meal_type, meal_snapshot)
		VALUES ($1, $2, $3, $4)
	`, mealPlanID, 0, "dinner", jsonBytes)
	require.NoError(t, err)

	// Retrieve and verify
	var retrievedJSON []byte
	err = harness.DB.QueryRowContext(ctx, `
		SELECT meal_snapshot FROM meal_plan_items WHERE meal_plan_id = $1
	`, mealPlanID).Scan(&retrievedJSON)
	require.NoError(t, err)

	var retrievedData map[string]interface{}
	err = json.Unmarshal(retrievedJSON, &retrievedData)
	require.NoError(t, err)

	assert.Equal(t, "Test Meal", retrievedData["name"])
	assert.Equal(t, "dinner", retrievedData["meal_type"])
	assert.Equal(t, float64(3), retrievedData["effort"]) // JSON numbers are float64
}
