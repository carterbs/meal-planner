package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"mealplanner/logging"
	"mealplanner/models"
)


type workflowService struct {
	db *sql.DB
}

var workflowServiceLogger = logging.GetLogger("workflow-service")

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

// GetWorkflowCheckpoint retrieves the raw checkpoint data for a thread
func (s *workflowService) GetWorkflowCheckpoint(threadID string) ([]byte, string, error) {
	workflowServiceLogger.Debugw("Getting workflow checkpoint for thread ID", "threadID", threadID)
	data, ns, err := models.GetWorkflowCheckpoint(s.db, threadID)
	if err != nil {
		workflowServiceLogger.Errorw("Failed to get workflow checkpoint for thread ID", "threadID", threadID, "error", err)
		return nil, "", fmt.Errorf("failed to get workflow checkpoint for thread ID %s: %w", threadID, err)
	}
	workflowServiceLogger.Debugw("Successfully retrieved workflow checkpoint for thread ID", "threadID", threadID)
	return data, ns, nil
}

// AddUserFeedback appends a user feedback message to the workflow and updates the state
func (s *workflowService) AddUserFeedback(threadID, from, message, timestamp string) error {
	workflowServiceLogger.Debugw("AddUserFeedback: Fetching workflow state", "threadID", threadID)
	state, err := s.GetWorkflowState(threadID)
	if err != nil {
		workflowServiceLogger.Errorw("AddUserFeedback: Failed to get workflow state", "error", err)
		return err
	}
	workflowServiceLogger.Debugw("AddUserFeedback: Current FeedbackHistory count", "count", len(state.FeedbackHistory))
	workflowServiceLogger.Debugw("AddUserFeedback: Appending feedback", "from", from, "message", message, "timestamp", timestamp)
	state.FeedbackHistory = append(state.FeedbackHistory, models.FeedbackEntry{
		From:      from,
		Message:   message,
		Timestamp: timestamp,
	})
	workflowServiceLogger.Debugw("AddUserFeedback: New FeedbackHistory count", "count", len(state.FeedbackHistory))
	err = s.UpdateWorkflowState(threadID, state)
	if err != nil {
		workflowServiceLogger.Errorw("AddUserFeedback: Failed to update workflow state", "error", err)
	} else {
		workflowServiceLogger.Debugw("AddUserFeedback: Successfully updated workflow state", "threadID", threadID)
	}
	return err
}

// AddAgentMessage appends an agent message to the workflow and updates the state
func (s *workflowService) AddAgentMessage(threadID, text, timestamp string) error {
	workflowServiceLogger.Debugw("AddAgentMessage: Fetching workflow state", "threadID", threadID)
	state, err := s.GetWorkflowState(threadID)
	if err != nil {
		workflowServiceLogger.Errorw("AddAgentMessage: Failed to get workflow state", "error", err)
		return err
	}
	workflowServiceLogger.Debugw("AddAgentMessage: Current AgentMessages count", "count", len(state.AgentMessages))
	workflowServiceLogger.Debugw("AddAgentMessage: Appending agent message", "sender", "agent", "text", text, "timestamp", timestamp)
	state.AgentMessages = append(state.AgentMessages, models.AgentMessage{
		Sender:    "agent",
		Text:      text,
		Timestamp: timestamp,
	})
	workflowServiceLogger.Debugw("AddAgentMessage: New AgentMessages count", "count", len(state.AgentMessages))
	err = s.UpdateWorkflowState(threadID, state)
	if err != nil {
		workflowServiceLogger.Errorw("AddAgentMessage: Failed to update workflow state", "error", err)
	} else {
		workflowServiceLogger.Debugw("AddAgentMessage: Successfully updated workflow state", "threadID", threadID)
	}
	return err
}

// UpdateWorkflowCheckpoint updates the raw checkpoint data for a thread
func (s *workflowService) UpdateWorkflowCheckpoint(threadID string, data []byte) error {
	workflowServiceLogger.Debugw("Updating workflow checkpoint for thread ID", "threadID", threadID)
	err := models.UpdateWorkflowCheckpoint(s.db, threadID, data)
	if err != nil {
		workflowServiceLogger.Errorw("Failed to update workflow checkpoint for thread ID", "threadID", threadID, "error", err)
		return fmt.Errorf("failed to update workflow checkpoint for thread ID %s: %w", threadID, err)
	}
	workflowServiceLogger.Debugw("Successfully updated workflow checkpoint for thread ID", "threadID", threadID)
	return nil
}