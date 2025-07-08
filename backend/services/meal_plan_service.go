package services

import (
	"database/sql"
	"fmt"

	"mealplanner/logging"
	"mealplanner/models"
)

type mealPlanService struct {
	db *sql.DB
}

var mealPlanServiceLogger = logging.GetLogger("meal-plan-service")

// NewMealPlanService creates a new meal plan service instance
func NewMealPlanService(db *sql.DB) MealPlanService {
	return &mealPlanService{db: db}
}

// GenerateWeeklyMealPlan generates a new weekly meal plan
func (s *mealPlanService) GenerateWeeklyMealPlan() (*models.WeeklyMealPlan, error) {
	mealPlanServiceLogger.Info("Generating new weekly meal plan")
	plan, err := models.GenerateWeeklyMealPlan(s.db)
	if err != nil {
		mealPlanServiceLogger.Errorw("Failed to generate weekly meal plan", "error", err)
		return nil, fmt.Errorf("failed to generate weekly meal plan: %w", err)
	}
	mealPlanServiceLogger.Debugw("Successfully generated weekly meal plan", "mealCount", len(plan.Days))
	return plan, nil
}

// GetLastPlannedMeals retrieves the most recently planned meals
func (s *mealPlanService) GetLastPlannedMeals() (*models.WeeklyMealPlan, error) {
	mealPlanServiceLogger.Info("Retrieving last planned meals")
	plan, err := models.GetLastPlannedMeals(s.db)
	if err != nil {
		mealPlanServiceLogger.Errorw("Failed to get last planned meals", "error", err)
		return nil, fmt.Errorf("failed to get last planned meals: %w", err)
	}
	mealPlanServiceLogger.Debugw("Successfully retrieved last planned meals", "mealCount", len(plan.Days))
	return plan, nil
}

// PopulateMealDetails populates meal details for a given plan
func (s *mealPlanService) PopulateMealDetails(plan *models.WeeklyMealPlan) (*models.WeeklyMealPlan, error) {
	if plan == nil {
		return nil, fmt.Errorf("plan is nil")
	}

	mealPlanServiceLogger.Debugw("Populating meal details for plan", "mealSlotCount", len(plan.Days))

	// Extract meal IDs from the plan
	mealIDs := make([]int, 0)
	for _, d := range plan.Days {
		if d.Meal != nil && int(d.Meal.GetId()) != 0 {
			mealIDs = append(mealIDs, int(d.Meal.GetId()))
		}
	}

	if len(mealIDs) == 0 {
		mealPlanServiceLogger.Debug("No meals to populate, returning original plan")
		return plan, nil
	}

	// Get meals with full details
	mealsWithIngredients, err := models.GetMealsByIDs(s.db, mealIDs)
	if err != nil {
		mealPlanServiceLogger.Errorw("Failed to get meals by IDs", "error", err)
		return nil, fmt.Errorf("failed to get meals by IDs: %w", err)
	}

	// Create a map for quick lookup
	mealMap := make(map[int]*models.Meal)
	for _, meal := range mealsWithIngredients {
		mealMap[int(meal.GetId())] = meal
	}

	// Create a copy of the plan with populated meal details
	populatedPlan := *plan
	populatedPlan.Days = make([]models.PlanDay, len(plan.Days))
	copy(populatedPlan.Days, plan.Days)

	for i := range populatedPlan.Days {
		d := &populatedPlan.Days[i]
		if d.Meal != nil {
			if fullMeal, ok := mealMap[int(d.Meal.GetId())]; ok {
				d.Meal = fullMeal
			}
		}
	}

	mealPlanServiceLogger.Debugw("Successfully populated meal details", "mealCount", len(mealIDs))
	return &populatedPlan, nil
}

// RemoveMealFromPlan removes a meal from a specific day and meal type
func (s *mealPlanService) RemoveMealFromPlan(plan *models.WeeklyMealPlan, dayIndex int, mealType string) error {
	mealPlanServiceLogger.Debugw("Removing meal from plan", "dayIndex", dayIndex, "mealType", mealType)
	err := models.RemoveMealFromPlan(plan, dayIndex, mealType)
	if err != nil {
		mealPlanServiceLogger.Errorw("Failed to remove meal from plan", "error", err)
		return fmt.Errorf("failed to remove meal from plan: %w", err)
	}
	mealPlanServiceLogger.Debugw("Successfully removed meal from plan", "dayIndex", dayIndex, "mealType", mealType)
	return nil
}

// SaveMealPlan persists a meal plan
func (s *mealPlanService) SaveMealPlan(threadID string, version int, entries []models.MealPlanEntry) (*models.MealPlanIdentifier, error) {
	return models.SaveMealPlan(s.db, threadID, version, entries)
}

// GetLatestMealPlan retrieves the latest meal plan identifier
func (s *mealPlanService) GetLatestMealPlan(threadID string) (*models.MealPlanIdentifier, error) {
	return models.GetLatestMealPlan(s.db, threadID)
}

// GetMealPlanItems retrieves entries for a meal plan
func (s *mealPlanService) GetMealPlanItems(mealPlanID int) ([]models.MealPlanEntry, error) {
	return models.GetMealPlanItems(s.db, mealPlanID)
}
