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

// MockMealPlanService mocks the MealPlanService interface for testing
type MockMealPlanService struct {
	mock.Mock
}

func (m *MockMealPlanService) GetLatestMealPlan(threadID string) (*models.MealPlanIdentifier, error) {
	args := m.Called(threadID)
	return args.Get(0).(*models.MealPlanIdentifier), args.Error(1)
}

func (m *MockMealPlanService) GetMealPlanItems(planID int) ([]models.MealPlanEntry, error) {
	args := m.Called(planID)
	return args.Get(0).([]models.MealPlanEntry), args.Error(1)
}

func (m *MockMealPlanService) GenerateWeeklyMealPlan() (*models.WeeklyMealPlan, error) {
	args := m.Called()
	return args.Get(0).(*models.WeeklyMealPlan), args.Error(1)
}

func (m *MockMealPlanService) GetLastPlannedMeals() (*models.WeeklyMealPlan, error) {
	args := m.Called()
	return args.Get(0).(*models.WeeklyMealPlan), args.Error(1)
}

func (m *MockMealPlanService) PopulateMealDetails(plan *models.WeeklyMealPlan) (*models.WeeklyMealPlan, error) {
	args := m.Called(plan)
	return args.Get(0).(*models.WeeklyMealPlan), args.Error(1)
}

func (m *MockMealPlanService) RemoveMealFromPlan(plan *models.WeeklyMealPlan, dayIndex int, mealType string) error {
	args := m.Called(plan, dayIndex, mealType)
	return args.Error(0)
}

func (m *MockMealPlanService) UpdateMealInPlan(plan *models.WeeklyMealPlan, dayIndex int, mealType string, meal *models.Meal) error {
	args := m.Called(plan, dayIndex, mealType, meal)
	return args.Error(0)
}

func (m *MockMealPlanService) GenerateShoppingListForPlan(plan *models.WeeklyMealPlan) error {
	args := m.Called(plan)
	return args.Error(0)
}

func (m *MockMealPlanService) SaveMealPlan(plan *models.WeeklyMealPlan) error {
	args := m.Called(plan)
	return args.Error(0)
}

func (m *MockMealPlanService) SaveMealPlanToDB(plan *models.WeeklyMealPlan) error {
	args := m.Called(plan)
	return args.Error(0)
}

func (m *MockMealPlanService) SaveMealPlanWithIdentifier(plan *models.WeeklyMealPlan, threadID string) (*models.MealPlanIdentifier, error) {
	args := m.Called(plan, threadID)
	return args.Get(0).(*models.MealPlanIdentifier), args.Error(1)
}

func (m *MockMealPlanService) UpdateMealPlanItems(planID int, items []models.MealPlanEntry) error {
	args := m.Called(planID, items)
	return args.Error(0)
}

// MockShoppingListService mocks the ShoppingListService interface for testing
type MockShoppingListService struct {
	mock.Mock
}

func (m *MockShoppingListService) BuildShoppingList(mealIDs []int) ([]models.ShoppingListItem, error) {
	args := m.Called(mealIDs)
	return args.Get(0).([]models.ShoppingListItem), args.Error(1)
}

func (m *MockShoppingListService) GenerateShoppingListFromMeals(meals []*models.Meal) []*models.Ingredient {
	args := m.Called(meals)
	return args.Get(0).([]*models.Ingredient)
}

func (m *MockShoppingListService) ConvertIngredientsToShoppingItems(ingredients []*models.Ingredient) []models.ShoppingListItem {
	args := m.Called(ingredients)
	return args.Get(0).([]models.ShoppingListItem)
}

// MockMessageService mocks the MessageService interface for testing
type MockMessageService struct {
	mock.Mock
}

func (m *MockMessageService) GetMessages(threadID string) ([]models.ChatMessage, error) {
	args := m.Called(threadID)
	return args.Get(0).([]models.ChatMessage), args.Error(1)
}

// stub implementations to satisfy services interfaces
type stubMealPlanService struct {
	mock.Mock
}

func (m *stubMealPlanService) GetLatestMealPlan(threadID string) (*models.MealPlanIdentifier, error) {
	args := m.Called(threadID)
	return args.Get(0).(*models.MealPlanIdentifier), args.Error(1)
}

func (m *stubMealPlanService) GetMealPlanItems(planID int) ([]models.MealPlanEntry, error) {
	args := m.Called(planID)
	return args.Get(0).([]models.MealPlanEntry), args.Error(1)
}

func (m *stubMealPlanService) GenerateWeeklyMealPlan() (*models.WeeklyMealPlan, error) {
	return nil, nil
}

func (m *stubMealPlanService) GetLastPlannedMeals() (*models.WeeklyMealPlan, error) {
	return nil, nil
}

func (m *stubMealPlanService) PopulateMealDetails(plan *models.WeeklyMealPlan) (*models.WeeklyMealPlan, error) {
	return nil, nil
}

func (m *stubMealPlanService) RemoveMealFromPlan(plan *models.WeeklyMealPlan, dayIndex int, mealType string) error {
	return nil
}

func (m *stubMealPlanService) SaveMealPlan(threadID string, version int, entries []models.MealPlanEntry) (*models.MealPlanIdentifier, error) {
	return nil, nil
}

// stub MessageService implementation
type stubMessageService struct {
	mock.Mock
}

func (m *stubMessageService) GetMessages(threadID string) ([]models.ChatMessage, error) {
	args := m.Called(threadID)
	return args.Get(0).([]models.ChatMessage), args.Error(1)
}

func (m *stubMessageService) AddMessage(threadID, sender, message string) (models.ChatMessage, error) {
	return models.ChatMessage{}, nil
}

func (m *stubMessageService) UpdateWorkflowCheckpointWithMessage(threadID, sender, message string) error {
	return nil
}

// TestGetWorkflowStateReturnsShoppingList ensures GET /api/workflows/{thread_id} returns a shopping list
func TestGetWorkflowStateReturnsShoppingList(t *testing.T) {
	originalServices := Services
	defer func() { Services = originalServices }()

	stubMealPlanSvc := new(stubMealPlanService)
	mockShoppingListSvc := new(MockShoppingListService)
	stubMessageSvc := new(stubMessageService)

	svc := &services.ServiceContainer{
		MealPlanService:     stubMealPlanSvc,
		ShoppingListService: mockShoppingListSvc,
		MessageService:      stubMessageSvc,
	}
	Services = svc

	threadID := "thread123"
	plan := &models.MealPlanIdentifier{ID: 1, ThreadID: threadID}
	entries := []models.MealPlanEntry{
		{DayOfWeek: 0, MealType: "breakfast", Meal: map[string]interface{}{"id": plan.ID, "name": "Test Meal"}},
	}
	shoppingItems := []models.ShoppingListItem{
		{Ingredient: "Eggs", Quantity: "12"},
	}
	messages := []models.ChatMessage{
		{Sender: "user", Text: "Hello"},
	}

	stubMealPlanSvc.On("GetLatestMealPlan", threadID).Return(plan, nil)
	stubMealPlanSvc.On("GetMealPlanItems", plan.ID).Return(entries, nil)
	mockShoppingListSvc.On("BuildShoppingList", []int{}).Return(shoppingItems, nil)
	stubMessageSvc.On("GetMessages", threadID).Return(messages, nil)

	req := httptest.NewRequest("GET", "/api/workflows/"+threadID, nil)
	rc := chi.NewRouteContext()
	rc.URLParams.Add("threadId", threadID)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rc))

	rr := httptest.NewRecorder()
	GetWorkflowState(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	sl, ok := resp["shopping_list"].([]interface{})
	if !ok {
		t.Errorf("shopping_list is missing or wrong type")
	}
	if len(sl) != 1 {
		t.Errorf("expected 1 shopping list item, got %d", len(sl))
	}

	stubMealPlanSvc.AssertExpectations(t)
	mockShoppingListSvc.AssertExpectations(t)
	stubMessageSvc.AssertExpectations(t)
}
