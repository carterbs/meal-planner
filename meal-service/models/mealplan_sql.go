package models

import (
	"database/sql"
	"encoding/json"
	apipb "mealplanner/generated/go"
	"time"
)

// MealPlanEntry is an alias to the generated protobuf type
type MealPlanEntry = apipb.MealPlanEntry

// MealPlanIdentifier represents a persisted meal plan
type MealPlanIdentifier struct {
	ID        int       `json:"id"`
	ThreadID  string    `json:"thread_id"`
	Version   int       `json:"version"`
	CreatedAt time.Time `json:"created_at"`
}

// GetLatestMealPlan retrieves the latest meal plan identifier for a thread
func GetLatestMealPlan(db *sql.DB, threadID string) (*MealPlanIdentifier, error) {
	const query = `
	SELECT id, thread_id, version, created_at
	FROM meal_plans
	WHERE thread_id = $1
	ORDER BY version DESC
	LIMIT 1`
	var m MealPlanIdentifier
	err := db.QueryRow(query, threadID).Scan(&m.ID, &m.ThreadID, &m.Version, &m.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// GetMealPlanItems retrieves items for a given meal plan
func GetMealPlanItems(db *sql.DB, mealPlanID int) ([]MealPlanEntry, error) {
	const query = `
	SELECT day_index, meal_type, meal
	FROM meal_plan_items
	WHERE meal_plan_id = $1
	ORDER BY day_index, meal_type`
	rows, err := db.Query(query, mealPlanID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var entries []MealPlanEntry
	for rows.Next() {
		var e MealPlanEntry
		var mealJSON []byte
		if err := rows.Scan(&e.DayIndex, &e.MealType, &mealJSON); err != nil {
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
