package services

import (
	"database/sql"
	apipb "mealplanner/generated/go"
	"mealplanner/models"
)

// SQLMealPlanService implements MealPlanService using Postgres
// and explicit SQL persistence
func SQLMealPlanService(db *sql.DB) MealPlanService {
	return &sqlMealPlanService{db: db}
}

type sqlMealPlanService struct {
	db *sql.DB
}

func (s *sqlMealPlanService) GenerateWeeklyMealPlan() (*apipb.WeeklyMealPlan, error) {
	// Delegate to existing model select logic
	return models.GenerateWeeklyMealPlan(s.db)
}

func (s *sqlMealPlanService) GetLastPlannedMeals() (*apipb.WeeklyMealPlan, error) {
	return models.GetLastPlannedMeals(s.db)
}

func (s *sqlMealPlanService) PopulateMealDetails(plan *apipb.WeeklyMealPlan) (*apipb.WeeklyMealPlan, error) {
	// Delegate to business service for populating meal details
	return NewMealPlanService(s.db).PopulateMealDetails(plan)
}

func (s *sqlMealPlanService) RemoveMealFromPlan(plan *apipb.WeeklyMealPlan, dayIndex int, mealType string) error {
	return models.RemoveMealFromPlan(plan, dayIndex, mealType)
}

func (s *sqlMealPlanService) SaveMealPlan(threadID string, version int, entries []models.MealPlanEntry) (*models.MealPlanIdentifier, error) {
	return models.SaveMealPlan(s.db, threadID, version, entries)
}

func (s *sqlMealPlanService) GetLatestMealPlan(threadID string) (*models.MealPlanIdentifier, error) {
	return models.GetLatestMealPlan(s.db, threadID)
}

func (s *sqlMealPlanService) GetMealPlanItems(mealPlanID int) ([]models.MealPlanEntry, error) {
	return models.GetMealPlanItems(s.db, mealPlanID)
}
