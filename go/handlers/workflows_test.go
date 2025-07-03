package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"mealplanner/models"
	"mealplanner/services"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockWorkflowService mocks the WorkflowService interface for testing
type MockWorkflowService struct {
	mock.Mock
}

func (m *MockWorkflowService) GetWorkflowState(threadID string) (*models.InternalWorkflowState, error) {
	args := m.Called(threadID)
	return args.Get(0).(*models.InternalWorkflowState), args.Error(1)
}

func (m *MockWorkflowService) UpdateWorkflowState(threadID string, state *models.InternalWorkflowState) error {
	args := m.Called(threadID, state)
	return args.Error(0)
}

func (m *MockWorkflowService) UpdateMealPlan(threadID string, plan *models.WeeklyMealPlan) error {
	args := m.Called(threadID, plan)
	return args.Error(0)
}

func (m *MockWorkflowService) GetMealPlan(threadID string) (*models.WeeklyMealPlan, error) {
	args := m.Called(threadID)
	return args.Get(0).(*models.WeeklyMealPlan), args.Error(1)
}

func (m *MockWorkflowService) GetWorkflowCheckpoint(threadID string) ([]byte, string, error) {
	args := m.Called(threadID)
	return args.Get(0).([]byte), args.String(1), args.Error(2)
}

func (m *MockWorkflowService) UpdateWorkflowCheckpoint(threadID string, data []byte) error {
	args := m.Called(threadID, data)
	return args.Error(0)
}

func (m *MockWorkflowService) AddUserFeedback(threadID, from, message, timestamp string) error {
	args := m.Called(threadID, from, message, timestamp)
	return args.Error(0)
}

func (m *MockWorkflowService) AddAgentMessage(threadID, text, timestamp string) error {
	args := m.Called(threadID, text, timestamp)
	return args.Error(0)
}

func (m *MockWorkflowService) AddMessage(threadID, sender, message string) (*models.ChatMessage, error) {
	args := m.Called(threadID, sender, message)
	return args.Get(0).(*models.ChatMessage), args.Error(1)
}

func (m *MockWorkflowService) UpdateWorkflowCheckpointWithMessage(threadID, sender, message string) error {
	args := m.Called(threadID, sender, message)
	return args.Error(0)
}

func TestGetWorkflowState_ShouldIncludeShoppingListFromMealPlan(t *testing.T) {
	// Create a mock workflow service
	mockService := &MockWorkflowService{}

	// Create test data with shopping list in the meal plan
	shoppingListItems := []models.ShoppingListItem{
		{Ingredient: "Eggs", Quantity: "12 each", Category: "Dairy"},
		{Ingredient: "Bread", Quantity: "1 loaf", Category: "Bakery"},
	}

	mealPlan := &models.WeeklyMealPlan{
		Days: []models.PlanDay{
			{
				Meal: &models.Meal{
					ID:       1,
					MealName: "Test Meal",
				},
				DayIndex: 0,
				MealType: "breakfast",
			},
		},
		ShoppingList: shoppingListItems,
	}

	workflowState := &models.InternalWorkflowState{
		ThreadID:        "test-thread-id",
		MealPlan:        mealPlan,
		ShoppingList:    nil, // No shopping list in the root state
		CurrentStep:     "test_step",
		FeedbackHistory: []models.FeedbackEntry{},
		AgentMessages:   []models.AgentMessage{},
	}

	// Set up the mock expectation
	mockService.On("GetWorkflowState", "test-thread-id").Return(workflowState, nil)

	// Replace the global Services with our mock
	originalServices := Services
	Services = &services.ServiceContainer{
		WorkflowService: mockService,
	}
	defer func() {
		Services = originalServices
	}()

	// Create a test request
	req := httptest.NewRequest("GET", "/api/workflows/test-thread-id", nil)

	// Create a chi router context with the threadId parameter
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("threadId", "test-thread-id")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	// Create a response recorder
	w := httptest.NewRecorder()

	// Call the handler
	GetWorkflowState(w, req)

	// Assert the response
	assert.Equal(t, http.StatusOK, w.Code)

	var response models.WorkflowState
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	// THIS IS THE FAILING ASSERTION - The shopping list should be populated
	// from the meal plan but currently returns null
	if string(response.ShoppingList) == "null" {
		t.Errorf("Shopping list should not be null when present in meal plan. Got: %s", response.ShoppingList)
		return
	}

	// Verify the shopping list contains the expected items
	var shoppingList []models.ShoppingListItem
	err = json.Unmarshal(response.ShoppingList, &shoppingList)
	assert.NoError(t, err)
	assert.Len(t, shoppingList, 2, "Shopping list should contain 2 items from meal plan")
	assert.Equal(t, "Eggs", shoppingList[0].Ingredient)
	assert.Equal(t, "Bread", shoppingList[1].Ingredient)

	// Verify mock was called
	mockService.AssertExpectations(t)
}
