package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"mealplanner/models"
)

// WorkflowService provides high-level operations for workflow state management
type WorkflowService interface {
	GetMealPlan(threadID string) (*models.WeeklyMealPlan, error)
	UpdateMealPlan(threadID string, plan *models.WeeklyMealPlan) error
	GetWorkflowState(threadID string) (*models.InternalWorkflowState, error)
	UpdateWorkflowState(threadID string, state *models.InternalWorkflowState) error
}

type workflowService struct {
	db *sql.DB
}

// NewWorkflowService creates a new instance of the workflow service
func NewWorkflowService(db *sql.DB) WorkflowService {
	return &workflowService{db: db}
}

// GetMealPlan retrieves the meal plan for a specific workflow thread
func (s *workflowService) GetMealPlan(threadID string) (*models.WeeklyMealPlan, error) {
	state, err := s.GetWorkflowState(threadID)
	if err != nil {
		return nil, fmt.Errorf("failed to get workflow state: %w", err)
	}
	
	if state.MealPlan == nil {
		return nil, fmt.Errorf("no meal plan found in workflow state")
	}
	
	return state.MealPlan, nil
}

// UpdateMealPlan updates the meal plan for a specific workflow thread
func (s *workflowService) UpdateMealPlan(threadID string, plan *models.WeeklyMealPlan) error {
	state, err := s.GetWorkflowState(threadID)
	if err != nil {
		return fmt.Errorf("failed to get workflow state: %w", err)
	}
	
	state.MealPlan = plan
	state.UpdatedAt = time.Now()
	
	return s.UpdateWorkflowState(threadID, state)
}

// GetWorkflowState retrieves the complete workflow state for a thread
func (s *workflowService) GetWorkflowState(threadID string) (*models.InternalWorkflowState, error) {
	checkpointData, _, err := models.GetWorkflowCheckpoint(s.db, threadID)
	if err != nil {
		return nil, fmt.Errorf("failed to get checkpoint: %w", err)
	}
	if checkpointData == nil {
		return nil, fmt.Errorf("no checkpoint found for thread %s", threadID)
	}
	
	checkpoint, err := models.ParseCheckpointData(checkpointData)
	if err != nil {
		return nil, fmt.Errorf("failed to parse checkpoint data: %w", err)
	}
	
	return &checkpoint.ChannelValues, nil
}

// UpdateWorkflowState updates the complete workflow state for a thread
func (s *workflowService) UpdateWorkflowState(threadID string, state *models.InternalWorkflowState) error {
	// Get the existing checkpoint structure to preserve the wrapper
	checkpointData, _, err := models.GetWorkflowCheckpoint(s.db, threadID)
	if err != nil {
		return fmt.Errorf("failed to get existing checkpoint: %w", err)
	}
	if checkpointData == nil {
		return fmt.Errorf("no existing checkpoint found for thread %s", threadID)
	}
	
	// Parse the existing checkpoint
	var fullCheckpoint map[string]interface{}
	if err := json.Unmarshal(checkpointData, &fullCheckpoint); err != nil {
		return fmt.Errorf("failed to parse existing checkpoint: %w", err)
	}
	
	// Update the channel_values with the new state
	fullCheckpoint["channel_values"] = state
	
	// Marshal back to bytes
	finalCheckpointBytes, err := json.Marshal(fullCheckpoint)
	if err != nil {
		return fmt.Errorf("failed to marshal updated checkpoint: %w", err)
	}
	
	// Save to database
	if err := models.UpdateWorkflowCheckpoint(s.db, threadID, finalCheckpointBytes); err != nil {
		return fmt.Errorf("failed to update checkpoint: %w", err)
	}
	
	return nil
}