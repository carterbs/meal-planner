package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"mealplanner/models"
)


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

// GetWorkflowCheckpoint retrieves the raw checkpoint data for a thread
func (s *workflowService) GetWorkflowCheckpoint(threadID string) ([]byte, string, error) {
	log.Printf("Getting workflow checkpoint for thread ID: %s", threadID)
	data, ns, err := models.GetWorkflowCheckpoint(s.db, threadID)
	if err != nil {
		log.Printf("Failed to get workflow checkpoint for thread ID %s: %v", threadID, err)
		return nil, "", fmt.Errorf("failed to get workflow checkpoint for thread ID %s: %w", threadID, err)
	}
	log.Printf("Successfully retrieved workflow checkpoint for thread ID %s", threadID)
	return data, ns, nil
}

// AddUserFeedback appends a user feedback message to the workflow and updates the state
func (s *workflowService) AddUserFeedback(threadID, from, message, timestamp string) error {
	log.Printf("[AddUserFeedback] Fetching workflow state for threadID=%s", threadID)
	state, err := s.GetWorkflowState(threadID)
	if err != nil {
		log.Printf("[AddUserFeedback] Failed to get workflow state: %v", err)
		return err
	}
	log.Printf("[AddUserFeedback] Current FeedbackHistory count: %d", len(state.FeedbackHistory))
	log.Printf("[AddUserFeedback] Appending feedback: from=%s, message=%q, timestamp=%s", from, message, timestamp)
	state.FeedbackHistory = append(state.FeedbackHistory, models.FeedbackEntry{
		From:      from,
		Message:   message,
		Timestamp: timestamp,
	})
	log.Printf("[AddUserFeedback] New FeedbackHistory count: %d", len(state.FeedbackHistory))
	err = s.UpdateWorkflowState(threadID, state)
	if err != nil {
		log.Printf("[AddUserFeedback] Failed to update workflow state: %v", err)
	} else {
		log.Printf("[AddUserFeedback] Successfully updated workflow state for threadID=%s", threadID)
	}
	return err
}

// AddAgentMessage appends an agent message to the workflow and updates the state
func (s *workflowService) AddAgentMessage(threadID, text, timestamp string) error {
	log.Printf("[AddAgentMessage] Fetching workflow state for threadID=%s", threadID)
	state, err := s.GetWorkflowState(threadID)
	if err != nil {
		log.Printf("[AddAgentMessage] Failed to get workflow state: %v", err)
		return err
	}
	log.Printf("[AddAgentMessage] Current AgentMessages count: %d", len(state.AgentMessages))
	log.Printf("[AddAgentMessage] Appending agent message: sender=agent, text=%q, timestamp=%s", text, timestamp)
	state.AgentMessages = append(state.AgentMessages, models.AgentMessage{
		Sender:    "agent",
		Text:      text,
		Timestamp: timestamp,
	})
	log.Printf("[AddAgentMessage] New AgentMessages count: %d", len(state.AgentMessages))
	err = s.UpdateWorkflowState(threadID, state)
	if err != nil {
		log.Printf("[AddAgentMessage] Failed to update workflow state: %v", err)
	} else {
		log.Printf("[AddAgentMessage] Successfully updated workflow state for threadID=%s", threadID)
	}
	return err
}

// UpdateWorkflowCheckpoint updates the raw checkpoint data for a thread
func (s *workflowService) UpdateWorkflowCheckpoint(threadID string, data []byte) error {
	log.Printf("Updating workflow checkpoint for thread ID: %s", threadID)
	err := models.UpdateWorkflowCheckpoint(s.db, threadID, data)
	if err != nil {
		log.Printf("Failed to update workflow checkpoint for thread ID %s: %v", threadID, err)
		return fmt.Errorf("failed to update workflow checkpoint for thread ID %s: %w", threadID, err)
	}
	log.Printf("Successfully updated workflow checkpoint for thread ID %s", threadID)
	return nil
}