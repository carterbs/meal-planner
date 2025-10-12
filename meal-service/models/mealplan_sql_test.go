package models

import (
	"context"
	"database/sql"
	"os"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

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
