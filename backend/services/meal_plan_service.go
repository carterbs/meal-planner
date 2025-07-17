package services

import (
	"context"
	"fmt"

	apipb "mealplanner/generated/go"
	"mealplanner/logging"
	"mealplanner/models"
	"mealplanner/repositories"
)

type mealPlanService struct {
	repo repositories.MealPlanRepository
}

var mealPlanServiceLogger = logging.GetGrpcLogger("meal-plan-service")

// NewMealPlanService creates a new meal plan service instance
func NewMealPlanService(repo repositories.MealPlanRepository) MealPlanService {
	return &mealPlanService{repo: repo}
}

// GenerateWeeklyMealPlan generates a new weekly meal plan
func (s *mealPlanService) GenerateWeeklyMealPlan() (*apipb.WeeklyMealPlan, error) {
	mealPlanServiceLogger.Info("Generating new weekly meal plan")
	plan, err := s.repo.GenerateWeeklyMealPlan(context.Background())
	if err != nil {
		mealPlanServiceLogger.Errorw("Failed to generate weekly meal plan", "error", err)
		return nil, fmt.Errorf("failed to generate weekly meal plan: %w", err)
	}
	mealPlanServiceLogger.Debugw("Successfully generated weekly meal plan", "mealCount", len(plan.Days))
	return plan, nil
}

// GetLastPlannedMeals retrieves the most recently planned meals
func (s *mealPlanService) GetLastPlannedMeals() (*apipb.WeeklyMealPlan, error) {
	mealPlanServiceLogger.Info("Retrieving last planned meals")
	plan, err := s.repo.GetLastPlannedMeals(context.Background())
	if err != nil {
		mealPlanServiceLogger.Errorw("Failed to get last planned meals", "error", err)
		return nil, fmt.Errorf("failed to get last planned meals: %w", err)
	}
	mealPlanServiceLogger.Debugw("Successfully retrieved last planned meals", "mealCount", len(plan.Days))
	return plan, nil
}

// PopulateMealDetails populates meal details for a given plan
func (s *mealPlanService) PopulateMealDetails(plan *apipb.WeeklyMealPlan) (*apipb.WeeklyMealPlan, error) {
	if plan == nil {
		return nil, fmt.Errorf("plan is nil")
	}

	mealPlanServiceLogger.Debugw("Populating meal details for plan", "mealSlotCount", len(plan.Days))

	// Delegate to the repository layer which has the database connection
	populatedPlan, err := s.repo.PopulateMealDetails(context.Background(), plan)
	if err != nil {
		mealPlanServiceLogger.Errorw("Failed to populate meal details", "error", err)
		return nil, fmt.Errorf("failed to populate meal details: %w", err)
	}

	mealPlanServiceLogger.Debugw("Successfully populated meal details")
	return populatedPlan, nil
}

// RemoveMealFromPlan removes a meal from a specific day and meal type
func (s *mealPlanService) RemoveMealFromPlan(plan *apipb.WeeklyMealPlan, dayIndex int, mealType string) error {
	mealPlanServiceLogger.Debugw("Removing meal from plan", "dayIndex", dayIndex, "mealType", mealType)
	err := s.repo.RemoveMealFromPlan(context.Background(), plan, dayIndex, mealType)
	if err != nil {
		mealPlanServiceLogger.Errorw("Failed to remove meal from plan", "error", err)
		return fmt.Errorf("failed to remove meal from plan: %w", err)
	}
	mealPlanServiceLogger.Debugw("Successfully removed meal from plan", "dayIndex", dayIndex, "mealType", mealType)
	return nil
}

// SaveMealPlan persists a meal plan
func (s *mealPlanService) SaveMealPlan(threadID string, version int, entries []models.MealPlanEntry) (*models.MealPlanIdentifier, error) {
	return s.repo.SaveMealPlan(context.Background(), threadID, version, entries)
}

// GetLatestMealPlan retrieves the latest meal plan identifier
func (s *mealPlanService) GetLatestMealPlan(threadID string) (*models.MealPlanIdentifier, error) {
	return s.repo.GetLatestMealPlan(context.Background(), threadID)
}

// GetMealPlanItems retrieves entries for a meal plan
func (s *mealPlanService) GetMealPlanItems(mealPlanID int) ([]models.MealPlanEntry, error) {
	return s.repo.GetMealPlanItems(context.Background(), mealPlanID)
}
