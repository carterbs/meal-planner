package services

import (
	"database/sql"
	"fmt"
	"log"

	"mealplanner/models"
)

type shoppingListService struct {
	db *sql.DB
}

// NewShoppingListService creates a new shopping list service instance
func NewShoppingListService(db *sql.DB) ShoppingListService {
	return &shoppingListService{db: db}
}

// BuildShoppingList builds a shopping list from meal IDs
func (s *shoppingListService) BuildShoppingList(mealIDs []int) ([]models.ShoppingListItem, error) {
	if len(mealIDs) == 0 {
		log.Printf("No meal IDs provided for shopping list")
		return []models.ShoppingListItem{}, nil
	}

	log.Printf("Building shopping list for %d meals", len(mealIDs))
	
	// Get meals with full ingredient details
	meals, err := models.GetMealsByIDs(s.db, mealIDs)
	if err != nil {
		log.Printf("Failed to get meals by IDs for shopping list: %v", err)
		return nil, fmt.Errorf("failed to get meals by IDs: %w", err)
	}

	// Generate aggregated ingredients
	ingredients := models.GenerateShoppingListFromMeals(meals)
	
	// Convert to shopping list items
	items := models.ConvertIngredientsToShoppingItems(ingredients)
	
	log.Printf("Generated shopping list with %d unique items", len(items))
	return items, nil
}

// GenerateShoppingListFromMeals aggregates ingredients from meals
func (s *shoppingListService) GenerateShoppingListFromMeals(meals []*models.Meal) []models.Ingredient {
	log.Printf("Generating shopping list from %d meals", len(meals))
	ingredients := models.GenerateShoppingListFromMeals(meals)
	log.Printf("Generated %d unique ingredients", len(ingredients))
	return ingredients
}

// ConvertIngredientsToShoppingItems converts ingredients to shopping list items
func (s *shoppingListService) ConvertIngredientsToShoppingItems(ingredients []models.Ingredient) []models.ShoppingListItem {
	log.Printf("Converting %d ingredients to shopping list items", len(ingredients))
	items := models.ConvertIngredientsToShoppingItems(ingredients)
	log.Printf("Converted to %d shopping list items", len(items))
	return items
}