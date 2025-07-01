package services

import (
	"database/sql"
	"fmt"
	"log"

	"mealplanner/models"
)

type mealService struct {
	db *sql.DB
}

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
	log.Printf("Creating meal: %s", meal.MealName)
	result, err := models.CreateMeal(s.db, meal)
	if err != nil {
		log.Printf("Failed to create meal %s: %v", meal.MealName, err)
		return nil, fmt.Errorf("failed to create meal: %w", err)
	}
	log.Printf("Successfully created meal: %s (ID: %d)", result.MealName, result.ID)
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
	log.Printf("Deleting meal with ID: %d", id)
	err := models.DeleteMeal(s.db, id)
	if err != nil {
		log.Printf("Failed to delete meal with ID %d: %v", id, err)
		return fmt.Errorf("failed to delete meal with ID %d: %w", id, err)
	}
	log.Printf("Successfully deleted meal with ID: %d", id)
	return nil
}

// SwapMeal swaps a meal with a random alternative meal of the same type
func (s *mealService) SwapMeal(mealID int, mealType string) (*models.Meal, error) {
	log.Printf("Swapping meal ID %d (type: %s)", mealID, mealType)
	meal, err := models.SwapMeal(mealID, mealType, s.db)
	if err != nil {
		log.Printf("Failed to swap meal ID %d: %v", mealID, err)
		return nil, fmt.Errorf("failed to swap meal ID %d: %w", mealID, err)
	}
	log.Printf("Successfully swapped meal ID %d with meal ID %d", mealID, meal.ID)
	return meal, nil
}

// UpdateLastPlannedDates updates the last planned dates for multiple meals
func (s *mealService) UpdateLastPlannedDates(mealIDs []int) error {
	log.Printf("Updating last planned dates for meal IDs: %v", mealIDs)
	err := models.UpdateLastPlannedDates(s.db, mealIDs)
	if err != nil {
		log.Printf("Failed to update last planned dates for meal IDs %v: %v", mealIDs, err)
		return fmt.Errorf("failed to update last planned dates for meal IDs %v: %w", mealIDs, err)
	}
	log.Printf("Successfully updated last planned dates for %d meals", len(mealIDs))
	return nil
}