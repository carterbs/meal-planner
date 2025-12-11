package models

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	apipb "mealplanner/generated/go"
	"mealplanner/logging"

	"go.uber.org/zap"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func getMealPlanServiceLogger() *zap.SugaredLogger {
	return logging.GetGrpcLogger("meal-plan-service")
}

// GenerateMealPlanItems builds MealPlanItem snapshots for the full week using
// the existing meal selection heuristics (effort bounds, red meat constraint,
// and last planned cut-offs).
func GenerateMealPlanItems(db *sql.DB) ([]*MealPlanItem, error) {
	items := make([]*MealPlanItem, 0, len(DaysOfTheWeek)*3)
	redMeatUsed := false
	threeWeeksAgo := time.Now().AddDate(0, 0, -21)
	mealTypes := []string{"breakfast", "lunch", "dinner"}

	for dayIndex, day := range DaysOfTheWeek {
		for _, mealType := range mealTypes {
			minEffort, maxEffort := effortBoundsForSlot(day, mealType)

			meal, err := pickMeal(db, minEffort, maxEffort, redMeatUsed, threeWeeksAgo, mealType)
			if err != nil {
				return nil, fmt.Errorf("failed picking %s for %s: %w", mealType, day, err)
			}

			if mealType == "dinner" && meal != nil && meal.GetHasRedMeat() {
				redMeatUsed = true
			}

			if meal != nil {
				getMealPlanServiceLogger().Debugw("Adding meal to plan",
					"dayIndex", dayIndex,
					"mealType", mealType,
					"mealName", meal.Name,
				)
			} else {
				getMealPlanServiceLogger().Debugw("Adding nil meal to plan",
					"dayIndex", dayIndex,
					"mealType", mealType,
				)
			}

			item := &MealPlanItem{
				DayIndex:  int32(dayIndex),
				MealType:  MealSlotFromString(mealType),
				CreatedAt: timestamppb.Now(),
				UpdatedAt: timestamppb.Now(),
			}

			if meal != nil {
				item.MealSnapshot = meal
				if meal.Id != 0 {
					mealID := meal.Id
					item.MealId = &mealID
				}
			}

			items = append(items, item)
		}
	}

	// Overwrite Friday dinner (dayIndex 4 == Friday) to "Eating out"
	for _, item := range items {
		if item.DayIndex == 4 && item.MealType == apipb.MealSlot_MEAL_SLOT_DINNER {
			item.MealSnapshot = &Meal{Name: "Eating out"}
			item.MealId = nil
			break
		}
	}

	if logging.IsVerbose() {
		getMealPlanServiceLogger().Infow("🔍 [BACKEND] Generated meal plan items")
		for i, item := range items {
			getMealPlanServiceLogger().Infow("🔍 [BACKEND] Meal item",
				"index", i,
				"dayIndex", item.DayIndex,
				"mealType", MealSlotToString(item.MealType),
				"mealName", func() string {
					if item.MealSnapshot != nil {
						return item.MealSnapshot.Name
					}
					return "nil"
				}(),
			)
		}
	}

	if len(items) > 7 {
		getMealPlanServiceLogger().Debugw("In the model, 8th meal", "dayIndex", items[7].DayIndex)
	}

	return items, nil
}

func effortBoundsForSlot(day string, mealType string) (int, int) {
	switch mealType {
	case "breakfast", "lunch":
		return 0, 2
	case "dinner":
		if day == "Monday" {
			return 0, 2
		}
		if day == "Sunday" {
			return 4, 10
		}
		return 3, 5
	default:
		return 0, 0
	}
}

// buildPickMealQuery returns the SQL query for selecting a meal.
// It appends an extra condition if excludeRedMeat is true.
func buildPickMealQuery(excludeRedMeat bool, _ string) string {
	columns := strings.Join(MealColumns, ", ")
	query := "SELECT " + columns + " FROM meals WHERE relative_effort BETWEEN $1 AND $2 AND (last_planned IS NULL OR last_planned < $3) AND meal_type = $4"
	if excludeRedMeat {
		query += " AND red_meat = false"
	}
	return query + " ORDER BY random() LIMIT 1;"
}

// pickMeal selects one meal from the database that meets the provided criteria:
// - The meal's effort is between minEffort and maxEffort (inclusive)
// - The meal has not been planned in the last 3 weeks (last_planned is either NULL or older than cutoff)
// - If excludeRedMeat is true, only meals with red_meat = false are eligible.
// - Filters by meal_type.
// The function orders the results randomly and returns the first matching meal.
func pickMeal(db *sql.DB, minEffort, maxEffort int, excludeRedMeat bool, cutoff time.Time, mealType string) (*Meal, error) {
	query := buildPickMealQuery(excludeRedMeat, mealType)

	row := db.QueryRow(query, minEffort, maxEffort, cutoff, mealType)
	var m Meal
	var id int32
	var name string
	var effort int32
	var lastPlanned sql.NullTime
	var hasRedMeat bool
	var url sql.NullString
	var mealTypeScanned string
	err := row.Scan(&id, &name, &effort, &lastPlanned, &hasRedMeat, &url, &mealTypeScanned)

	m.Id = id
	m.Name = name
	m.Effort = effort
	m.HasRedMeat = hasRedMeat
	m.MealType = mealTypeScanned
	m.LastPlanned = nil
	if url.Valid {
		m.Url = url.String
	}
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// It's okay to not find a meal (e.g., no breakfasts in DB). Return nil.
			return nil, nil
		}
		return nil, err
	}
	if lastPlanned.Valid {
		m.LastPlanned = timestamppb.New(lastPlanned.Time)
	}

	return &m, nil
}
