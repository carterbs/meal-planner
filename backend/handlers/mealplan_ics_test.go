package handlers

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"mealplanner/models"
	"mealplanner/services"
)

// mockMealPlanService implements the MealPlanService interface for testing
type mockMealPlanService struct{}

func (m *mockMealPlanService) GetLastPlannedMeals() (*models.WeeklyMealPlan, error) {
	// Return an error to trigger generation path
	return nil, errors.New("no recent meal plan found")
}

func (m *mockMealPlanService) GenerateWeeklyMealPlan() (*models.WeeklyMealPlan, error) {
	// Return a simple test meal plan
	testMeal := &models.Meal{
		Id:       1,
		Name:     "Test Meal",
		MealType: "dinner",
		Url:      "https://example.com",
	}

	plan := &models.WeeklyMealPlan{
		Days: []models.PlanDay{
			{DayIndex: 0, MealType: "dinner", Meal: testMeal},
		},
	}
	return plan, nil
}

func (m *mockMealPlanService) PopulateMealDetails(plan *models.WeeklyMealPlan) (*models.WeeklyMealPlan, error) {
	return plan, nil
}

func (m *mockMealPlanService) RemoveMealFromPlan(plan *models.WeeklyMealPlan, dayIndex int, mealType string) error {
	return nil
}

func TestMealPlanICSHandler(t *testing.T) {
	// Store original Services and restore after test
	originalServices := Services
	defer func() { Services = originalServices }()

	// Create a mock service container with our mock meal plan service
	mockServices := &services.ServiceContainer{}
	mockServices.MealPlanService = &mockMealPlanService{}
	Services = mockServices

	req, err := http.NewRequest("GET", "/api/mealplan/ics", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	rr := httptest.NewRecorder()

	MealPlanICSHandler(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200 got %d, response: %s", rr.Code, rr.Body.String())
	}
	if ct := rr.Header().Get("Content-Type"); ct != "text/calendar" {
		t.Errorf("unexpected content type %s", ct)
	}
	if len(rr.Body.String()) == 0 || !strings.Contains(rr.Body.String(), "BEGIN:VCALENDAR") {
		t.Errorf("invalid ics output")
	}
}
