package services

import (
	"database/sql"
	"fmt"

	"mealplanner/logging"
	"mealplanner/models"
)

type mealService struct {
	db *sql.DB
}

var mealServiceLogger = logging.GetLogger("meal-service")

// NewMealService creates a new meal service instance
func NewMealService(db *sql.DB) MealService {
	return &mealService{db: db}
}

// GetAllMeals retrieves all meals from the database
func (s *mealService) GetAllMeals() ([]*models.Meal, error) {
	meals, err := models.GetAllMeals(s.db)
	if err != nil {
		return nil, fmt.Errorf("failed to get all meals: %w", err)
	}
	return meals, nil
}

// GetMealsByIDs retrieves meals by their IDs
func (s *mealService) GetMealsByIDs(ids []int) ([]*models.Meal, error) {
	meals, err := models.GetMealsByIDs(s.db, ids)
	if err != nil {
		return nil, fmt.Errorf("failed to get meals by IDs %v: %w", ids, err)
	}
	return meals, nil
}

// CreateMeal creates a new meal in the database
func (s *mealService) CreateMeal(meal models.Meal) (*models.Meal, error) {
	mealServiceLogger.Debugw("Creating meal", "mealName", meal.MealName)
	result, err := models.CreateMeal(s.db, meal)
	if err != nil {
		mealServiceLogger.Errorw("Failed to create meal", "mealName", meal.MealName, "error", err)
		return nil, fmt.Errorf("failed to create meal: %w", err)
	}
	mealServiceLogger.Debugw("Successfully created meal", "mealName", result.MealName, "mealID", result.ID)
	return result, nil
}

// UpdateMeal updates an existing meal in the database
func (s *mealService) UpdateMeal(meal *models.Meal) error {
	// Note: This method is not implemented in the original models
	// This would need to be implemented in models if required
	return fmt.Errorf("UpdateMeal not yet implemented")
}

// DeleteMeal deletes a meal from the database
func (s *mealService) DeleteMeal(id int) error {
	mealServiceLogger.Debugw("Deleting meal", "mealID", id)
	err := models.DeleteMeal(s.db, id)
	if err != nil {
		mealServiceLogger.Errorw("Failed to delete meal", "mealID", id, "error", err)
		return fmt.Errorf("failed to delete meal with ID %d: %w", id, err)
	}
	mealServiceLogger.Debugw("Successfully deleted meal", "mealID", id)
	return nil
}

// SwapMeal swaps a meal with a random alternative meal of the same type
func (s *mealService) SwapMeal(mealID int, mealType string) (*models.Meal, error) {
	mealServiceLogger.Debugw("Swapping meal", "mealID", mealID, "mealType", mealType)
	meal, err := models.SwapMeal(mealID, mealType, s.db)
	if err != nil {
		mealServiceLogger.Errorw("Failed to swap meal", "mealID", mealID, "error", err)
		return nil, fmt.Errorf("failed to swap meal ID %d: %w", mealID, err)
	}
	mealServiceLogger.Debugw("Successfully swapped meal", "oldMealID", mealID, "newMealID", meal.ID)
	return meal, nil
}

// UpdateLastPlannedDates updates the last planned dates for multiple meals
func (s *mealService) UpdateLastPlannedDates(mealIDs []int) error {
	mealServiceLogger.Debugw("Updating last planned dates for meals", "mealIDs", mealIDs)
	err := models.UpdateLastPlannedDates(s.db, mealIDs)
	if err != nil {
		mealServiceLogger.Errorw("Failed to update last planned dates for meals", "mealIDs", mealIDs, "error", err)
		return fmt.Errorf("failed to update last planned dates for meal IDs %v: %w", mealIDs, err)
	}
	mealServiceLogger.Debugw("Successfully updated last planned dates for meals", "mealCount", len(mealIDs))
	return nil
}
