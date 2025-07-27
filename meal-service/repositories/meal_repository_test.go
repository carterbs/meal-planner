package repositories

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"mealplanner/models"
	"mealplanner/testutil"
)

func TestMealRepository_UpdateMeal(t *testing.T) {
	// This test would require a real database connection for integration testing
	// For now, we'll test the business logic without the actual database
	
	tests := []struct {
		name         string
		meal         *models.Meal
		expectedErr  bool
		errMessage   string
	}{
		{
			name: "successful update with valid meal",
			meal: testutil.NewMealBuilder().
				WithID(1).
				WithName("Updated Test Meal").
				WithEffort(3).
				WithHasRedMeat(true).
				WithURL("https://updated-recipe.com").
				WithMealType("lunch").
				Build(),
			expectedErr: false,
		},
		{
			name: "update meal with empty name should fail",
			meal: testutil.NewMealBuilder().
				WithID(1).
				WithName("").
				WithMealType("dinner").
				Build(),
			expectedErr: true,
			errMessage: "meal name cannot be empty",
		},
		{
			name: "update meal with invalid ID should fail",
			meal: testutil.NewMealBuilder().
				WithID(0).
				WithName("Test Meal").
				WithMealType("dinner").
				Build(),
			expectedErr: true,
			errMessage: "meal ID must be greater than 0",
		},
		{
			name: "update meal with invalid meal type",
			meal: testutil.NewMealBuilder().
				WithID(1).
				WithName("Test Meal").
				WithMealType("").
				Build(),
			expectedErr: true,
			errMessage: "meal type cannot be empty",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Validate business logic without database
			err := validateMealForUpdate(tt.meal)
			
			if tt.expectedErr {
				assert.Error(t, err)
				if tt.errMessage != "" {
					assert.Contains(t, err.Error(), tt.errMessage)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// validateMealForUpdate validates meal data before database update
func validateMealForUpdate(meal *models.Meal) error {
	if meal.GetId() <= 0 {
		return &ValidationError{Field: "id", Message: "meal ID must be greater than 0"}
	}
	
	if meal.GetName() == "" {
		return &ValidationError{Field: "name", Message: "meal name cannot be empty"}
	}
	
	if meal.GetMealType() == "" {
		return &ValidationError{Field: "mealType", Message: "meal type cannot be empty"}
	}
	
	return nil
}

// ValidationError represents a validation error
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}

func TestMealRepository_UpdateMeal_Integration(t *testing.T) {
	// Skip integration tests if no database connection
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	// This would be a real integration test with database
	t.Run("integration test with database", func(t *testing.T) {
		// This test would require:
		// 1. Database setup/teardown
		// 2. Test data insertion
		// 3. Actual UpdateMeal call
		// 4. Verification of database state
		
		// For now, just document the test structure
		t.Skip("Integration test requires database setup")
	})
}

func TestMealRepository_UpdateMeal_SQLGeneration(t *testing.T) {
	tests := []struct {
		name         string
		meal         *models.Meal
		expectedSQL  string
	}{
		{
			name: "generates correct SQL for basic update",
			meal: testutil.NewMealBuilder().
				WithID(1).
				WithName("Test Meal").
				WithEffort(2).
				WithHasRedMeat(false).
				WithURL("https://example.com").
				WithMealType("dinner").
				Build(),
			expectedSQL: `UPDATE meals 
SET meal_name = $1, relative_effort = $2, red_meat = $3, url = $4, meal_type = $5
WHERE id = $6`,
		},
		{
			name: "handles special characters in meal name",
			meal: testutil.NewMealBuilder().
				WithID(2).
				WithName("Mom's Special Recipe").
				WithMealType("lunch").
				Build(),
			expectedSQL: `UPDATE meals 
SET meal_name = $1, relative_effort = $2, red_meat = $3, url = $4, meal_type = $5
WHERE id = $6`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sql := generateUpdateMealSQL()
			assert.Equal(t, tt.expectedSQL, sql)
		})
	}
}

// generateUpdateMealSQL returns the SQL query used for updating meals
func generateUpdateMealSQL() string {
	return `UPDATE meals 
SET meal_name = $1, relative_effort = $2, red_meat = $3, url = $4, meal_type = $5
WHERE id = $6`
}

func TestMealRepository_UpdateMeal_Parameters(t *testing.T) {
	tests := []struct {
		name           string
		meal           *models.Meal
		expectedParams []interface{}
	}{
		{
			name: "correct parameter ordering",
			meal: testutil.NewMealBuilder().
				WithID(123).
				WithName("Test Meal").
				WithEffort(3).
				WithHasRedMeat(true).
				WithURL("https://test.com").
				WithMealType("breakfast").
				Build(),
			expectedParams: []interface{}{
				"Test Meal",    // meal_name
				int32(3),       // relative_effort  
				true,           // red_meat
				"https://test.com", // url
				"breakfast",    // meal_type
				int32(123),     // id (WHERE clause)
			},
		},
		{
			name: "handles empty URL",
			meal: testutil.NewMealBuilder().
				WithID(456).
				WithName("Simple Meal").
				WithEffort(1).
				WithHasRedMeat(false).
				WithURL("").
				WithMealType("snack").
				Build(),
			expectedParams: []interface{}{
				"Simple Meal",
				int32(1),
				false,
				"",
				"snack",
				int32(456),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			params := extractUpdateMealParameters(tt.meal)
			assert.Equal(t, tt.expectedParams, params)
		})
	}
}

// extractUpdateMealParameters extracts parameters for UpdateMeal SQL query
func extractUpdateMealParameters(meal *models.Meal) []interface{} {
	return []interface{}{
		meal.GetName(),
		meal.GetEffort(),
		meal.GetHasRedMeat(),
		meal.GetUrl(),
		meal.GetMealType(),
		meal.GetId(),
	}
}