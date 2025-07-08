package models

import (
	"encoding/json"
	"regexp"
	"testing"
	"time"

	apipb "mealplanner/generated/go"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
)

func TestSaveMealPlan_Success(t *testing.T) {
	db, mock, err := sqlmock.New()
	assert.NoError(t, err)
	defer db.Close()

	threadID := "thread1"
	version := 1
	testMeal := &apipb.Meal{Id: 101, Name: "Test Meal"}
	entries := []MealPlanEntry{
		{DayOfWeek: 0, MealType: "breakfast", Meal: testMeal},
	}

	// Mock plan insert
	mock.ExpectQuery(regexp.QuoteMeta("INSERT INTO meal_plans")).
		WithArgs(threadID, version).
		WillReturnRows(sqlmock.NewRows([]string{"id", "thread_id", "version", "created_at"}).
			AddRow(42, threadID, version, time.Now()))

	// Mock item insert - now expects JSON meal
	expectedMealJSON, _ := json.Marshal(testMeal)
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO meal_plan_items")).
		WithArgs(42, entries[0].DayOfWeek, entries[0].MealType, expectedMealJSON).
		WillReturnResult(sqlmock.NewResult(1, 1))

	id, err := SaveMealPlan(db, threadID, version, entries)
	assert.NoError(t, err)
	assert.Equal(t, 42, id.ID)
	assert.Equal(t, threadID, id.ThreadID)
	assert.Equal(t, version, id.Version)

	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetLatestMealPlan_Success(t *testing.T) {
	db, mock, err := sqlmock.New()
	assert.NoError(t, err)
	defer db.Close()

	threadID := "thread1"
	mockRows := sqlmock.NewRows([]string{"id", "thread_id", "version", "created_at"}).
		AddRow(43, threadID, 2, time.Now())
	mock.ExpectQuery(regexp.QuoteMeta("SELECT id, thread_id, version, created_at")).
		WithArgs(threadID).
		WillReturnRows(mockRows)

	mp, err := GetLatestMealPlan(db, threadID)
	assert.NoError(t, err)
	assert.Equal(t, 43, mp.ID)
	assert.Equal(t, threadID, mp.ThreadID)
	assert.Equal(t, 2, mp.Version)

	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetMealPlanItems_Success(t *testing.T) {
	db, mock, err := sqlmock.New()
	assert.NoError(t, err)
	defer db.Close()

	mealPlanID := 42
	testMeal := &apipb.Meal{Id: 202, Name: "Test Lunch Meal"}
	mealJSON, _ := json.Marshal(testMeal)
	mockRows := sqlmock.NewRows([]string{"day_of_week", "meal_type", "meal"}).
		AddRow(1, "lunch", mealJSON)
	mock.ExpectQuery(regexp.QuoteMeta("SELECT day_of_week, meal_type, meal")).
		WithArgs(mealPlanID).
		WillReturnRows(mockRows)

	items, err := GetMealPlanItems(db, mealPlanID)
	assert.NoError(t, err)
	assert.Len(t, items, 1)
	assert.Equal(t, int32(1), items[0].DayOfWeek)
	assert.Equal(t, "lunch", items[0].MealType)
	assert.Equal(t, testMeal, items[0].Meal)

	assert.NoError(t, mock.ExpectationsWereMet())
}
