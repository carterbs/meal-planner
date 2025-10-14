package models

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	apipb "mealplanner/generated/go"
	"mealplanner/logging"
)

func TestMain(m *testing.M) {
	logging.ResetForTest()
	os.Setenv("DISABLE_GRPC_LOGGING", "true")
	code := m.Run()
	logging.ResetForTest()
	os.Exit(code)
}

func setupMockDB(t *testing.T) (*sql.DB, sqlmock.Sqlmock, func()) {
	t.Helper()

	db, mock, err := sqlmock.New()
	require.NoError(t, err)

	cleanup := func() {
		db.Close()
	}

	return db, mock, cleanup
}

func TestGetMealPlanByID_ConvertsTimestamps(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()

	weekStart := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)
	createdAt := time.Date(2025, 1, 1, 12, 0, 0, 0, time.UTC)
	updatedAt := createdAt.Add(time.Hour)

	planQuery := regexp.QuoteMeta(`
		SELECT id, week_start_date, week_end_date, status, version, thread_id, created_at, updated_at
		FROM meal_plans
		WHERE id = $1
	`)

	mock.ExpectQuery(planQuery).
		WithArgs(42).
		WillReturnRows(
			sqlmock.NewRows([]string{
				"id", "week_start_date", "week_end_date", "status", "version", "thread_id", "created_at", "updated_at",
			}).AddRow(int32(42), weekStart, weekEnd, "draft", int32(3), "thread-123", createdAt, updatedAt),
		)

	itemsQuery := regexp.QuoteMeta(`
		SELECT id, meal_plan_id, day_index, meal_type, meal_id, meal_snapshot, created_at, updated_at
		FROM meal_plan_items
		WHERE meal_plan_id = $1
		ORDER BY day_index, meal_type
	`)
	mock.ExpectQuery(itemsQuery).
		WithArgs(42).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "meal_plan_id", "day_index", "meal_type", "meal_id", "meal_snapshot", "created_at", "updated_at",
		}))

	plan, err := GetMealPlanByID(context.Background(), db, 42)
	require.NoError(t, err)
	require.NotNil(t, plan)

	require.NotNil(t, plan.WeekStartDate)
	require.NotNil(t, plan.WeekEndDate)
	require.NotNil(t, plan.CreatedAt)
	require.NotNil(t, plan.UpdatedAt)

	assert.True(t, plan.WeekStartDate.AsTime().Equal(weekStart))
	assert.True(t, plan.WeekEndDate.AsTime().Equal(weekEnd))
	assert.True(t, plan.CreatedAt.AsTime().Equal(createdAt))
	assert.True(t, plan.UpdatedAt.AsTime().Equal(updatedAt))

	require.NoError(t, mock.ExpectationsWereMet())
}

func TestGetMealPlanByWeek_ConvertsTimestamps(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()

	weekStart := time.Date(2025, 2, 3, 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)
	createdAt := time.Date(2025, 2, 1, 8, 30, 0, 0, time.UTC)
	updatedAt := createdAt.Add(2 * time.Hour)

	planQuery := regexp.QuoteMeta(`
		SELECT id, week_start_date, week_end_date, status, version, thread_id, created_at, updated_at
		FROM meal_plans
		WHERE week_start_date = $1 AND week_end_date = $2
		ORDER BY version DESC
		LIMIT 1
	`)

	mock.ExpectQuery(planQuery).
		WithArgs(weekStart, weekEnd).
		WillReturnRows(
			sqlmock.NewRows([]string{
				"id", "week_start_date", "week_end_date", "status", "version", "thread_id", "created_at", "updated_at",
			}).AddRow(int32(99), weekStart, weekEnd, "finalized", int32(4), nil, createdAt, updatedAt),
		)

	itemsQuery := regexp.QuoteMeta(`
		SELECT id, meal_plan_id, day_index, meal_type, meal_id, meal_snapshot, created_at, updated_at
		FROM meal_plan_items
		WHERE meal_plan_id = $1
		ORDER BY day_index, meal_type
	`)
	mock.ExpectQuery(itemsQuery).
		WithArgs(99).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "meal_plan_id", "day_index", "meal_type", "meal_id", "meal_snapshot", "created_at", "updated_at",
		}))

	plan, err := GetMealPlanByWeek(context.Background(), db, weekStart)
	require.NoError(t, err)
	require.NotNil(t, plan)

	assert.True(t, plan.WeekStartDate.AsTime().Equal(weekStart))
	assert.True(t, plan.WeekEndDate.AsTime().Equal(weekEnd))
	assert.True(t, plan.CreatedAt.AsTime().Equal(createdAt))
	assert.True(t, plan.UpdatedAt.AsTime().Equal(updatedAt))

	require.NoError(t, mock.ExpectationsWereMet())
}

func TestListMealPlansInRange_ConvertsTimestamps(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()

	start := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 1, 0)
	weekStart := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)
	createdAt := start.Add(2 * time.Hour)
	updatedAt := createdAt.Add(30 * time.Minute)

	listQuery := regexp.QuoteMeta(`
		SELECT
			mp.id,
			mp.week_start_date,
			mp.week_end_date,
			mp.status,
			mp.version,
			mp.thread_id,
			mp.created_at,
			mp.updated_at,
			COUNT(mpi.id) as item_count
		FROM meal_plans mp
		LEFT JOIN meal_plan_items mpi ON mp.id = mpi.meal_plan_id
		WHERE mp.week_start_date >= $1 AND mp.week_end_date <= $2
		GROUP BY mp.id, mp.week_start_date, mp.week_end_date, mp.status, mp.version, mp.thread_id, mp.created_at, mp.updated_at
		ORDER BY mp.week_start_date DESC
	`)

	mock.ExpectQuery(listQuery).
		WithArgs(start, end).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "week_start_date", "week_end_date", "status", "version", "thread_id", "created_at", "updated_at", "item_count",
		}).AddRow(int32(7), weekStart, weekEnd, "draft", int32(1), "thread-abc", createdAt, updatedAt, int64(14)))

	summaries, err := ListMealPlansInRange(context.Background(), db, start, end, nil)
	require.NoError(t, err)
	require.Len(t, summaries, 1)

	sum := summaries[0]
	assert.True(t, sum.WeekStartDate.AsTime().Equal(weekStart))
	assert.True(t, sum.WeekEndDate.AsTime().Equal(weekEnd))
	assert.True(t, sum.CreatedAt.AsTime().Equal(createdAt))
	assert.True(t, sum.UpdatedAt.AsTime().Equal(updatedAt))

	require.NoError(t, mock.ExpectationsWereMet())
}

func TestInsertMealPlan_Success(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()

	weekStart := time.Date(2025, 3, 3, 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)

	insertQuery := regexp.QuoteMeta(`
		INSERT INTO meal_plans (week_start_date, week_end_date, status, thread_id, version)
		VALUES ($1, $2, $3, $4, 1)
		RETURNING id
	`)

	mock.ExpectBegin()
	mock.ExpectQuery(insertQuery).
		WithArgs(weekStart, weekEnd, "draft", nil).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(int32(15)))
	mock.ExpectCommit()

	tx, err := db.Begin()
	require.NoError(t, err)

	id, err := InsertMealPlan(context.Background(), tx, weekStart, weekEnd, apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, nil)
	require.NoError(t, err)
	assert.Equal(t, 15, id)

	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestInsertMealPlan_ReturnsErrorOnConflict(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()

	weekStart := time.Date(2025, 4, 7, 0, 0, 0, 0, time.UTC)
	weekEnd := weekStart.AddDate(0, 0, 6)

	insertQuery := regexp.QuoteMeta(`
		INSERT INTO meal_plans (week_start_date, week_end_date, status, thread_id, version)
		VALUES ($1, $2, $3, $4, 1)
		RETURNING id
	`)

	mock.ExpectBegin()
	mock.ExpectQuery(insertQuery).
		WithArgs(weekStart, weekEnd, "finalized", sqlmock.AnyArg()).
		WillReturnError(assert.AnError)
	mock.ExpectRollback()

	threadID := "thread-dup"
	tx, err := db.Begin()
	require.NoError(t, err)

	_, err = InsertMealPlan(context.Background(), tx, weekStart, weekEnd, apipb.MealPlanStatus_MEAL_PLAN_STATUS_FINALIZED, &threadID)
	require.Error(t, err)

	require.NoError(t, tx.Rollback())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestUpsertMealPlanItems_HappyPath(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()

	deleteQuery := regexp.QuoteMeta(`DELETE FROM meal_plan_items WHERE meal_plan_id = $1`)
	insertQuery := regexp.QuoteMeta(`
		INSERT INTO meal_plan_items (meal_plan_id, day_index, meal_type, meal_id, meal_snapshot)
		VALUES ($1, $2, $3, $4, $5)
	`)

	mock.ExpectBegin()
	mock.ExpectExec(deleteQuery).
		WithArgs(77).
		WillReturnResult(sqlmock.NewResult(0, 2))

	mockedMeal := &Meal{
		Id:         42,
		Name:       "Mock Paella",
		Effort:     3,
		HasRedMeat: false,
		MealType:   "dinner",
	}
	expectedSnapshot, err := json.Marshal(mockedMeal)
	require.NoError(t, err)

	mock.ExpectPrepare(insertQuery).
		ExpectExec().
		WithArgs(77, int32(2), "dinner", int32(42), expectedSnapshot).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	item := &MealPlanItem{
		MealPlanId:   77,
		DayIndex:     2,
		MealType:     apipb.MealSlot_MEAL_SLOT_DINNER,
		MealSnapshot: mockedMeal,
	}
	if mockedMeal.Id != 0 {
		mealID := mockedMeal.Id
		item.MealId = &mealID
	}

	tx, err := db.Begin()
	require.NoError(t, err)

	err = UpsertMealPlanItems(context.Background(), tx, 77, []*MealPlanItem{item})
	require.NoError(t, err)

	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestUpsertMealPlanItems_ClearsExisting(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()

	deleteQuery := regexp.QuoteMeta(`DELETE FROM meal_plan_items WHERE meal_plan_id = $1`)

	mock.ExpectBegin()
	mock.ExpectExec(deleteQuery).
		WithArgs(501).
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectCommit()

	tx, err := db.Begin()
	require.NoError(t, err)

	err = UpsertMealPlanItems(context.Background(), tx, 501, nil)
	require.NoError(t, err)

	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestUpsertMealPlanItems_UniqueConstraintError(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()

	deleteQuery := regexp.QuoteMeta(`DELETE FROM meal_plan_items WHERE meal_plan_id = $1`)
	insertQuery := regexp.QuoteMeta(`
		INSERT INTO meal_plan_items (meal_plan_id, day_index, meal_type, meal_id, meal_snapshot)
		VALUES ($1, $2, $3, $4, $5)
	`)

	mock.ExpectBegin()
	mock.ExpectExec(deleteQuery).
		WithArgs(88).
		WillReturnResult(sqlmock.NewResult(0, 0))

	mock.ExpectPrepare(insertQuery).
		ExpectExec().
		WithArgs(88, int32(0), "breakfast", nil, []byte("{}")).
		WillReturnError(assert.AnError)
	mock.ExpectRollback()

	item := &MealPlanItem{
		MealPlanId: 88,
		DayIndex:   0,
		MealType:   apipb.MealSlot_MEAL_SLOT_BREAKFAST,
	}

	tx, err := db.Begin()
	require.NoError(t, err)

	err = UpsertMealPlanItems(context.Background(), tx, 88, []*MealPlanItem{item})
	require.Error(t, err)

	require.NoError(t, tx.Rollback())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestUpdateMealPlanStatus_AllTransitions(t *testing.T) {
	statuses := []MealPlanStatus{
		apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT,
		apipb.MealPlanStatus_MEAL_PLAN_STATUS_FINALIZED,
		apipb.MealPlanStatus_MEAL_PLAN_STATUS_ARCHIVED,
		apipb.MealPlanStatus_MEAL_PLAN_STATUS_ABANDONED,
	}

	for _, status := range statuses {
		t.Run(MealPlanStatusToString(status), func(t *testing.T) {
			db, mock, cleanup := setupMockDB(t)
			defer cleanup()

			updateQuery := regexp.QuoteMeta(`UPDATE meal_plans SET status = $1 WHERE id = $2`)

			mock.ExpectBegin()
			mock.ExpectExec(updateQuery).
				WithArgs(MealPlanStatusToString(status), 321).
				WillReturnResult(sqlmock.NewResult(0, 1))
			mock.ExpectCommit()

			tx, err := db.Begin()
			require.NoError(t, err)

			err = UpdateMealPlanStatus(context.Background(), tx, 321, status)
			require.NoError(t, err)

			require.NoError(t, tx.Commit())
			require.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

func TestUpdateMealPlanVersion_SetsVersion(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()

	updateQuery := regexp.QuoteMeta(`UPDATE meal_plans SET version = $1 WHERE id = $2`)

	mock.ExpectBegin()
	mock.ExpectExec(updateQuery).
		WithArgs(7, 654).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	tx, err := db.Begin()
	require.NoError(t, err)

	err = UpdateMealPlanVersion(context.Background(), tx, 654, 7)
	require.NoError(t, err)

	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestListMealPlansInRange_WithStatusFilter(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()

	start := time.Date(2025, 5, 5, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 0, 14)

	status := apipb.MealPlanStatus_MEAL_PLAN_STATUS_FINALIZED

	listQuery := regexp.QuoteMeta(`
		SELECT
			mp.id,
			mp.week_start_date,
			mp.week_end_date,
			mp.status,
			mp.version,
			mp.thread_id,
			mp.created_at,
			mp.updated_at,
			COUNT(mpi.id) as item_count
		FROM meal_plans mp
		LEFT JOIN meal_plan_items mpi ON mp.id = mpi.meal_plan_id
		WHERE mp.week_start_date >= $1 AND mp.week_end_date <= $2 AND mp.status = $3
		GROUP BY mp.id, mp.week_start_date, mp.week_end_date, mp.status, mp.version, mp.thread_id, mp.created_at, mp.updated_at
		ORDER BY mp.week_start_date DESC
	`)

	weekStart := start.AddDate(0, 0, 7)
	weekEnd := weekStart.AddDate(0, 0, 6)
	createdAt := start.Add(12 * time.Hour)
	updatedAt := createdAt.Add(3 * time.Hour)

	mock.ExpectQuery(listQuery).
		WithArgs(start, end, "finalized").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "week_start_date", "week_end_date", "status", "version", "thread_id", "created_at", "updated_at", "item_count",
		}).AddRow(int32(9), weekStart, weekEnd, "finalized", int32(3), nil, createdAt, updatedAt, int64(21)))

	summaries, err := ListMealPlansInRange(context.Background(), db, start, end, &status)
	require.NoError(t, err)
	require.Len(t, summaries, 1)

	sum := summaries[0]
	assert.Equal(t, apipb.MealPlanStatus_MEAL_PLAN_STATUS_FINALIZED, sum.Status)
	assert.True(t, sum.WeekStartDate.AsTime().Equal(weekStart))

	require.NoError(t, mock.ExpectationsWereMet())
}

func TestGetMealPlanItemsInternal_UnmarshalsSnapshot(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()

	query := regexp.QuoteMeta(`
		SELECT id, meal_plan_id, day_index, meal_type, meal_id, meal_snapshot, created_at, updated_at
		FROM meal_plan_items
		WHERE meal_plan_id = $1
		ORDER BY day_index, meal_type
	`)

	now := time.Now().UTC().Truncate(time.Second)
	mockMeal := &Meal{
		Id:         7,
		Name:       "Round Trip Curry",
		MealType:   "dinner",
		Effort:     2,
		HasRedMeat: false,
	}
	snapshot, err := json.Marshal(mockMeal)
	require.NoError(t, err)

	mock.ExpectQuery(query).
		WithArgs(900).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "meal_plan_id", "day_index", "meal_type", "meal_id", "meal_snapshot", "created_at", "updated_at",
		}).AddRow(int32(11), int32(900), int32(4), "dinner", int32(7), snapshot, now, now))

	items, err := getMealPlanItemsInternal(context.Background(), db, 900)
	require.NoError(t, err)
	require.Len(t, items, 1)

	item := items[0]
	require.NotNil(t, item.MealSnapshot)
	assert.Equal(t, "Round Trip Curry", item.MealSnapshot.Name)
	assert.NotNil(t, item.CreatedAt)
	assert.NotNil(t, item.UpdatedAt)

	require.NoError(t, mock.ExpectationsWereMet())
}
