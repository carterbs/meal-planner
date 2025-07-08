package models

import (
	"database/sql"
	"encoding/json"
	"time"

	apipb "mealplanner/generated/go"
)

// MealPlanEntry is an alias to the generated protobuf type
type MealPlanEntry = apipb.MealPlanEntry

// MealPlanIdentifier represents a persisted meal plan
// MealPlanIdentifier aliases the protobuf message
type MealPlanIdentifier = apipb.MealPlanIdentifier

// SaveMealPlan persists a meal plan and its items
func SaveMealPlan(db *sql.DB, threadID string, version int, entries []MealPlanEntry) (*MealPlanIdentifier, error) {
	// Insert into meal_plans
	const planQuery = `
	INSERT INTO meal_plans (thread_id, version)
	VALUES ($1, $2)
	RETURNING id, thread_id, version, created_at`
	var id int
	var tid string
	var ver int
	var createdAt time.Time
	err := db.QueryRow(planQuery, threadID, version).Scan(&id, &tid, &ver, &createdAt)
	if err != nil {
		return nil, err
	}
	// Insert items
	const itemQuery = `
	INSERT INTO meal_plan_items (meal_plan_id, day_of_week, meal_type, meal)
	VALUES ($1, $2, $3, $4)`
	for _, e := range entries {
		mealJSON, err := json.Marshal(e.Meal)
		if err != nil {
			return nil, err
		}
		if _, err := db.Exec(itemQuery, id, e.DayOfWeek, e.MealType, mealJSON); err != nil {
			return nil, err
		}
	}
	return &MealPlanIdentifier{
		Id:        int32(id),
		ThreadId:  tid,
		Version:   int32(ver),
		CreatedAt: createdAt.Format(time.RFC3339),
	}, nil
}

// GetLatestMealPlan retrieves the latest meal plan identifier for a thread
func GetLatestMealPlan(db *sql.DB, threadID string) (*MealPlanIdentifier, error) {
	const query = `
	SELECT id, thread_id, version, created_at
	FROM meal_plans
	WHERE thread_id = $1
	ORDER BY version DESC
	LIMIT 1`
	var id int
	var tid string
	var ver int
	var createdAt time.Time
	err := db.QueryRow(query, threadID).Scan(&id, &tid, &ver, &createdAt)
	if err != nil {
		return nil, err
	}
	return &MealPlanIdentifier{
		Id:        int32(id),
		ThreadId:  tid,
		Version:   int32(ver),
		CreatedAt: createdAt.Format(time.RFC3339),
	}, nil
}

// GetMealPlanItems retrieves items for a given meal plan
func GetMealPlanItems(db *sql.DB, mealPlanID int) ([]MealPlanEntry, error) {
	const query = `
	SELECT day_of_week, meal_type, meal
	FROM meal_plan_items
	WHERE meal_plan_id = $1
	ORDER BY day_of_week, meal_type`
	rows, err := db.Query(query, mealPlanID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var entries []MealPlanEntry
	for rows.Next() {
		var e MealPlanEntry
		var mealJSON []byte
		if err := rows.Scan(&e.DayOfWeek, &e.MealType, &mealJSON); err != nil {
			return nil, err
		}

		// Unmarshal the JSON into a Meal object
		var meal Meal
		if err := json.Unmarshal(mealJSON, &meal); err != nil {
			return nil, err
		}
		e.Meal = &meal
		entries = append(entries, e)
	}
	return entries, nil
}
