package services

import (
	"database/sql"
	"fmt"
	"log"

	"mealplanner/models"
)

type mealPlanService struct {
	db *sql.DB
}

// NewMealPlanService creates a new meal plan service instance
func NewMealPlanService(db *sql.DB) MealPlanService {
	return &mealPlanService{db: db}
}

// GenerateWeeklyMealPlan generates a new weekly meal plan
func (s *mealPlanService) GenerateWeeklyMealPlan() (*models.WeeklyMealPlan, error) {
	log.Printf("Generating new weekly meal plan")
	plan, err := models.GenerateWeeklyMealPlan(s.db)
	if err != nil {
		log.Printf("Failed to generate weekly meal plan: %v", err)
		return nil, fmt.Errorf("failed to generate weekly meal plan: %w", err)
	}
	log.Printf("Successfully generated weekly meal plan with %d meals", len(plan.Days))
	return plan, nil
}

// GetLastPlannedMeals retrieves the most recently planned meals
func (s *mealPlanService) GetLastPlannedMeals() (*models.WeeklyMealPlan, error) {
	log.Printf("Retrieving last planned meals")
	plan, err := models.GetLastPlannedMeals(s.db)
	if err != nil {
		log.Printf("Failed to get last planned meals: %v", err)
		return nil, fmt.Errorf("failed to get last planned meals: %w", err)
	}
	log.Printf("Successfully retrieved last planned meals with %d meals", len(plan.Days))
	return plan, nil
}

// PopulateMealDetails populates meal details for a given plan
func (s *mealPlanService) PopulateMealDetails(plan *models.WeeklyMealPlan) (*models.WeeklyMealPlan, error) {
	if plan == nil {
		return nil, fmt.Errorf("plan is nil")
	}

	log.Printf("Populating meal details for plan with %d meal slots", len(plan.Days))
	
	// Extract meal IDs from the plan
	mealIDs := make([]int, 0)
	for _, d := range plan.Days {
		if d.Meal != nil && d.Meal.ID != 0 {
			mealIDs = append(mealIDs, d.Meal.ID)
		}
	}

	if len(mealIDs) == 0 {
		log.Printf("No meals to populate, returning original plan")
		return plan, nil
	}

	// Get meals with full details
	mealsWithIngredients, err := models.GetMealsByIDs(s.db, mealIDs)
	if err != nil {
		log.Printf("Failed to get meals by IDs: %v", err)
		return nil, fmt.Errorf("failed to get meals by IDs: %w", err)
	}

	// Create a map for quick lookup
	mealMap := make(map[int]*models.Meal)
	for _, meal := range mealsWithIngredients {
		mealMap[meal.ID] = meal
	}

	// Create a copy of the plan with populated meal details
	populatedPlan := *plan
	populatedPlan.Days = make([]models.PlanDay, len(plan.Days))
	copy(populatedPlan.Days, plan.Days)

	for i := range populatedPlan.Days {
		d := &populatedPlan.Days[i]
		if d.Meal != nil {
			if fullMeal, ok := mealMap[d.Meal.ID]; ok {
				d.Meal = fullMeal
			}
		}
	}

	log.Printf("Successfully populated meal details for %d meals", len(mealIDs))
	return &populatedPlan, nil
}

// RemoveMealFromPlan removes a meal from a specific day and meal type
func (s *mealPlanService) RemoveMealFromPlan(plan *models.WeeklyMealPlan, dayIndex int, mealType string) error {
	log.Printf("Removing meal from plan: day %d, meal type %s", dayIndex, mealType)
	err := models.RemoveMealFromPlan(plan, dayIndex, mealType)
	if err != nil {
		log.Printf("Failed to remove meal from plan: %v", err)
		return fmt.Errorf("failed to remove meal from plan: %w", err)
	}
	log.Printf("Successfully removed meal from plan: day %d, meal type %s", dayIndex, mealType)
	return nil
}