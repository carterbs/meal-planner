package models

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	apipb "mealplanner/generated/go"
	"mealplanner/logging"

	"go.uber.org/zap"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func getMealPlanModelLogger() *zap.SugaredLogger {
	return logging.GetGrpcLogger("mealplan-model")
}

// Helper functions for enum conversions
func MealSlotFromString(s string) MealSlot {
	switch s {
	case "breakfast":
		return apipb.MealSlot_MEAL_SLOT_BREAKFAST
	case "lunch":
		return apipb.MealSlot_MEAL_SLOT_LUNCH
	case "dinner":
		return apipb.MealSlot_MEAL_SLOT_DINNER
	default:
		return apipb.MealSlot_MEAL_SLOT_UNSPECIFIED
	}
}

func MealSlotToString(slot MealSlot) string {
	switch slot {
	case apipb.MealSlot_MEAL_SLOT_BREAKFAST:
		return "breakfast"
	case apipb.MealSlot_MEAL_SLOT_LUNCH:
		return "lunch"
	case apipb.MealSlot_MEAL_SLOT_DINNER:
		return "dinner"
	default:
		return ""
	}
}

func MealPlanStatusFromString(s string) MealPlanStatus {
	switch s {
	case "draft":
		return apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT
	case "finalized":
		return apipb.MealPlanStatus_MEAL_PLAN_STATUS_FINALIZED
	case "archived":
		return apipb.MealPlanStatus_MEAL_PLAN_STATUS_ARCHIVED
	case "abandoned":
		return apipb.MealPlanStatus_MEAL_PLAN_STATUS_ABANDONED
	default:
		return apipb.MealPlanStatus_MEAL_PLAN_STATUS_UNSPECIFIED
	}
}

func MealPlanStatusToString(status MealPlanStatus) string {
	switch status {
	case apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT:
		return "draft"
	case apipb.MealPlanStatus_MEAL_PLAN_STATUS_FINALIZED:
		return "finalized"
	case apipb.MealPlanStatus_MEAL_PLAN_STATUS_ARCHIVED:
		return "archived"
	case apipb.MealPlanStatus_MEAL_PLAN_STATUS_ABANDONED:
		return "abandoned"
	default:
		return ""
	}
}

// InsertMealPlan creates a new meal plan record
func InsertMealPlan(ctx context.Context, tx *sql.Tx, weekStart, weekEnd time.Time, status MealPlanStatus, threadID *string) (int, error) {
	logger := getMealPlanModelLogger()

	query := `
		INSERT INTO meal_plans (week_start_date, week_end_date, status, thread_id, version)
		VALUES ($1, $2, $3, $4, 1)
		RETURNING id
	`

	var id int
	statusStr := MealPlanStatusToString(status)
	err := tx.QueryRowContext(ctx, query, weekStart, weekEnd, statusStr, threadID).Scan(&id)
	if err != nil {
		logger.Errorw("InsertMealPlan: error inserting meal plan", "error", err)
		return 0, err
	}

	logger.Debugw("InsertMealPlan: created meal plan", "id", id, "weekStart", weekStart, "status", statusStr)
	return id, nil
}

// GetMealPlanByID retrieves a complete meal plan with its items
func GetMealPlanByID(ctx context.Context, db *sql.DB, id int) (*MealPlan, error) {
	logger := getMealPlanModelLogger()

	// First get the meal plan metadata
	planQuery := `
		SELECT id, week_start_date, week_end_date, status, version, thread_id, created_at, updated_at
		FROM meal_plans
		WHERE id = $1
	`

	var plan MealPlan
	var statusStr string
	var threadID sql.NullString
	var createdAt, updatedAt time.Time
	var weekStart, weekEnd time.Time

	err := db.QueryRowContext(ctx, planQuery, id).Scan(
		&plan.Id,
		&weekStart,
		&weekEnd,
		&statusStr,
		&plan.Version,
		&threadID,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("meal plan not found: %d", id)
		}
		logger.Errorw("GetMealPlanByID: error fetching meal plan", "id", id, "error", err)
		return nil, err
	}

	// Convert values
	plan.Status = MealPlanStatusFromString(statusStr)
	if threadID.Valid {
		plan.ThreadId = &threadID.String
	}
	plan.WeekStartDate = timestamppb.New(weekStart)
	plan.WeekEndDate = timestamppb.New(weekEnd)
	plan.CreatedAt = timestamppb.New(createdAt)
	plan.UpdatedAt = timestamppb.New(updatedAt)

	// Now get the items
	items, err := getMealPlanItemsInternal(ctx, db, id)
	if err != nil {
		logger.Errorw("GetMealPlanByID: error fetching items", "id", id, "error", err)
		return nil, err
	}
	plan.Items = items

	logger.Debugw("GetMealPlanByID: retrieved meal plan", "id", id, "itemCount", len(items))
	return &plan, nil
}

// GetMealPlanByWeek retrieves a meal plan for a specific week
func GetMealPlanByWeek(ctx context.Context, db *sql.DB, weekStart time.Time) (*MealPlan, error) {
	logger := getMealPlanModelLogger()

	// Calculate week end (6 days after start)
	weekEnd := weekStart.AddDate(0, 0, 6)

	planQuery := `
		SELECT id, week_start_date, week_end_date, status, version, thread_id, created_at, updated_at
		FROM meal_plans
		WHERE week_start_date = $1 AND week_end_date = $2
		ORDER BY version DESC
		LIMIT 1
	`

	var plan MealPlan
	var statusStr string
	var threadID sql.NullString
	var createdAt, updatedAt time.Time
	var weekStartDB, weekEndDB time.Time

	err := db.QueryRowContext(ctx, planQuery, weekStart, weekEnd).Scan(
		&plan.Id,
		&weekStartDB,
		&weekEndDB,
		&statusStr,
		&plan.Version,
		&threadID,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // Not found is not an error
		}
		logger.Errorw("GetMealPlanByWeek: error fetching meal plan", "weekStart", weekStart, "error", err)
		return nil, err
	}

	plan.Status = MealPlanStatusFromString(statusStr)
	if threadID.Valid {
		plan.ThreadId = &threadID.String
	}
	plan.WeekStartDate = timestamppb.New(weekStartDB)
	plan.WeekEndDate = timestamppb.New(weekEndDB)
	plan.CreatedAt = timestamppb.New(createdAt)
	plan.UpdatedAt = timestamppb.New(updatedAt)

	items, err := getMealPlanItemsInternal(ctx, db, int(plan.Id))
	if err != nil {
		logger.Errorw("GetMealPlanByWeek: error fetching items", "id", plan.Id, "error", err)
		return nil, err
	}
	plan.Items = items

	return &plan, nil
}

// ListMealPlansInRange retrieves meal plan summaries for a date range
func ListMealPlansInRange(ctx context.Context, db *sql.DB, start, end time.Time, status *MealPlanStatus) ([]*MealPlanSummary, error) {
	logger := getMealPlanModelLogger()

	query := `
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
	`

	args := []interface{}{start, end}

	if status != nil {
		query += " AND mp.status = $3"
		args = append(args, MealPlanStatusToString(*status))
	}

	query += `
		GROUP BY mp.id, mp.week_start_date, mp.week_end_date, mp.status, mp.version, mp.thread_id, mp.created_at, mp.updated_at
		ORDER BY mp.week_start_date DESC
	`

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		logger.Errorw("ListMealPlansInRange: error executing query", "error", err)
		return nil, err
	}
	defer rows.Close()

	var summaries []*MealPlanSummary
	for rows.Next() {
		var summary MealPlanSummary
		var statusStr string
		var threadID sql.NullString
		var createdAt, updatedAt time.Time
		var weekStartDB, weekEndDB time.Time

		err := rows.Scan(
			&summary.Id,
			&weekStartDB,
			&weekEndDB,
			&statusStr,
			&summary.Version,
			&threadID,
			&createdAt,
			&updatedAt,
			&summary.ItemCount,
		)
		if err != nil {
			logger.Errorw("ListMealPlansInRange: error scanning row", "error", err)
			return nil, err
		}

		summary.Status = MealPlanStatusFromString(statusStr)
		if threadID.Valid {
			summary.ThreadId = &threadID.String
		}
		summary.WeekStartDate = timestamppb.New(weekStartDB)
		summary.WeekEndDate = timestamppb.New(weekEndDB)
		summary.CreatedAt = timestamppb.New(createdAt)
		summary.UpdatedAt = timestamppb.New(updatedAt)

		summaries = append(summaries, &summary)
	}

	if err := rows.Err(); err != nil {
		logger.Errorw("ListMealPlansInRange: error in row iteration", "error", err)
		return nil, err
	}

	logger.Debugw("ListMealPlansInRange: retrieved summaries", "count", len(summaries))
	return summaries, nil
}

// UpdateMealPlanStatus updates the status of a meal plan
func UpdateMealPlanStatus(ctx context.Context, tx *sql.Tx, id int, status MealPlanStatus) error {
	logger := getMealPlanModelLogger()

	query := `UPDATE meal_plans SET status = $1 WHERE id = $2`
	statusStr := MealPlanStatusToString(status)

	result, err := tx.ExecContext(ctx, query, statusStr, id)
	if err != nil {
		logger.Errorw("UpdateMealPlanStatus: error updating status", "id", id, "status", statusStr, "error", err)
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("meal plan not found: %d", id)
	}

	logger.Debugw("UpdateMealPlanStatus: updated status", "id", id, "status", statusStr)
	return nil
}

// UpsertMealPlanItems inserts or updates meal plan items in a transaction
func UpsertMealPlanItems(ctx context.Context, tx *sql.Tx, mealPlanID int, items []*MealPlanItem) error {
	logger := getMealPlanModelLogger()

	// First, delete existing items for this meal plan
	deleteQuery := `DELETE FROM meal_plan_items WHERE meal_plan_id = $1`
	_, err := tx.ExecContext(ctx, deleteQuery, mealPlanID)
	if err != nil {
		logger.Errorw("UpsertMealPlanItems: error deleting existing items", "mealPlanID", mealPlanID, "error", err)
		return err
	}

	if len(items) == 0 {
		logger.Debugw("UpsertMealPlanItems: cleared items", "mealPlanID", mealPlanID)
		return nil
	}

	// Now insert new items
	insertQuery := `
		INSERT INTO meal_plan_items (meal_plan_id, day_index, meal_type, meal_id, meal_snapshot)
		VALUES ($1, $2, $3, $4, $5)
	`

	stmt, err := tx.PrepareContext(ctx, insertQuery)
	if err != nil {
		logger.Errorw("UpsertMealPlanItems: error preparing statement", "error", err)
		return err
	}
	defer stmt.Close()

	for _, item := range items {
		// Marshal meal_snapshot to JSON
		var snapshotJSON []byte
		if item.MealSnapshot != nil {
			snapshotJSON, err = json.Marshal(item.MealSnapshot)
			if err != nil {
				logger.Errorw("UpsertMealPlanItems: error marshaling meal snapshot", "error", err)
				return err
			}
		} else {
			snapshotJSON = []byte("{}")
		}

		// Convert meal_type enum to string
		mealTypeStr := MealSlotToString(item.MealType)

		// Handle optional meal_id
		var mealID interface{}
		if item.MealId != nil {
			mealID = *item.MealId
		} else {
			mealID = nil
		}

		_, err = stmt.ExecContext(ctx, mealPlanID, item.DayIndex, mealTypeStr, mealID, snapshotJSON)
		if err != nil {
			logger.Errorw("UpsertMealPlanItems: error inserting item", "mealPlanID", mealPlanID, "dayIndex", item.DayIndex, "error", err)
			return err
		}
	}

	logger.Debugw("UpsertMealPlanItems: upserted items", "mealPlanID", mealPlanID, "itemCount", len(items))
	return nil
}

// UpdateMealPlanVersion updates the version of a meal plan
func UpdateMealPlanVersion(ctx context.Context, tx *sql.Tx, id int, version int) error {
	logger := getMealPlanModelLogger()

	query := `UPDATE meal_plans SET version = $1 WHERE id = $2`

	result, err := tx.ExecContext(ctx, query, version, id)
	if err != nil {
		logger.Errorw("UpdateMealPlanVersion: error updating version", "id", id, "version", version, "error", err)
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("meal plan not found: %d", id)
	}

	logger.Debugw("UpdateMealPlanVersion: updated version", "id", id, "version", version)
	return nil
}

// getMealPlanItemsInternal retrieves items for a meal plan (internal helper)
func getMealPlanItemsInternal(ctx context.Context, db *sql.DB, mealPlanID int) ([]*MealPlanItem, error) {
	logger := getMealPlanModelLogger()

	query := `
		SELECT id, meal_plan_id, day_index, meal_type, meal_id, meal_snapshot, created_at, updated_at
		FROM meal_plan_items
		WHERE meal_plan_id = $1
		ORDER BY day_index, meal_type
	`

	rows, err := db.QueryContext(ctx, query, mealPlanID)
	if err != nil {
		logger.Errorw("getMealPlanItemsInternal: error executing query", "mealPlanID", mealPlanID, "error", err)
		return nil, err
	}
	defer rows.Close()

	var items []*MealPlanItem
	for rows.Next() {
		var item MealPlanItem
		var mealTypeStr string
		var mealID sql.NullInt32
		var snapshotJSON []byte
		var createdAt, updatedAt time.Time

		err := rows.Scan(
			&item.Id,
			&item.MealPlanId,
			&item.DayIndex,
			&mealTypeStr,
			&mealID,
			&snapshotJSON,
			&createdAt,
			&updatedAt,
		)
		if err != nil {
			logger.Errorw("getMealPlanItemsInternal: error scanning row", "error", err)
			return nil, err
		}

		item.MealType = MealSlotFromString(mealTypeStr)
		if mealID.Valid {
			mealIDVal := mealID.Int32
			item.MealId = &mealIDVal
		}

		// Unmarshal meal_snapshot
		var meal Meal
		if err := json.Unmarshal(snapshotJSON, &meal); err != nil {
			logger.Errorw("getMealPlanItemsInternal: error unmarshaling snapshot", "error", err)
			return nil, err
		}
		item.MealSnapshot = &meal

		item.CreatedAt = timestamppb.New(createdAt)
		item.UpdatedAt = timestamppb.New(updatedAt)

		items = append(items, &item)
	}

	if err := rows.Err(); err != nil {
		logger.Errorw("getMealPlanItemsInternal: error in row iteration", "error", err)
		return nil, err
	}

	return items, nil
}
