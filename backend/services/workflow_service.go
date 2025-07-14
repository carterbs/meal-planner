package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	apipb "mealplanner/generated/go"
	"mealplanner/logging"
	"mealplanner/models"
)

type workflowService struct {
	db *sql.DB
}

var workflowServiceLogger = logging.GetGrpcLogger("workflow-service")

// NewWorkflowService creates a new instance of the workflow service
func NewWorkflowService(db *sql.DB) WorkflowService {
	return &workflowService{db: db}
}

// GetMealPlan retrieves the meal plan for a specific workflow thread
func (s *workflowService) GetMealPlan(threadID string) (*apipb.WeeklyMealPlan, error) {
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
func (s *workflowService) UpdateMealPlan(threadID string, plan *apipb.WeeklyMealPlan) error {
	// Persist the plan to the relational tables as a new version so that
	// GET /api/workflows/{threadId} (which reads from those tables) reflects
	// the latest state. This keeps the database in sync with the checkpoint.

	// 1. Determine the next version number.
	var version int
	if latest, err := models.GetLatestMealPlan(s.db, threadID); err == nil {
		version = latest.Version + 1
	} else if err == sql.ErrNoRows {
		version = 1
	} else if err != nil {
		workflowServiceLogger.Warnw("Failed to fetch latest meal plan version - skipping RDBMS persist", "error", err)
	}

	// 2. Convert WeeklyMealPlan -> []MealPlanEntry
	entries := make([]models.MealPlanEntry, 0, len(plan.Days))
	for _, d := range plan.Days {
		entries = append(entries, models.MealPlanEntry{
			DayIndex: int32(d.DayIndex),
			MealType: d.MealType,
			Meal:     d.Meal,
		})
	}

	if version > 0 {
		if _, err := models.SaveMealPlan(s.db, threadID, version, entries); err != nil {
			workflowServiceLogger.Warnw("Failed to persist updated meal plan", "error", err)
		}
	}
	state, err := s.GetWorkflowState(threadID)
	if err != nil {
		return fmt.Errorf("failed to get workflow state: %w", err)
	}

	state.MealPlan = plan
	state.UpdatedAt = time.Now()

	// 3. Update checkpoint as before
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

	return &checkpoint.State, nil
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

	// Switch to canonical `state` key, removing any legacy `channel_values`
	delete(fullCheckpoint, "channel_values")
	fullCheckpoint["state"] = state

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

// AddMessage adds a message to the workflow (generic version)
func (s *workflowService) AddMessage(threadID, sender, message string) (*models.ChatMessage, error) {
	workflowServiceLogger.Debugw("Adding message to workflow", "threadID", threadID, "sender", sender)
	msg, err := models.AddMessage(s.db, threadID, sender, message)
	if err != nil {
		workflowServiceLogger.Errorw("Failed to add message", "threadID", threadID, "sender", sender, "error", err)
		return nil, fmt.Errorf("failed to add message for thread ID %s: %w", threadID, err)
	}
	workflowServiceLogger.Debugw("Successfully added message", "threadID", threadID, "sender", msg.Sender)
	return &msg, nil
}

// UpdateWorkflowCheckpointWithMessage updates the workflow checkpoint with a system message
func (s *workflowService) UpdateWorkflowCheckpointWithMessage(threadID, sender, message string) error {
	workflowServiceLogger.Debugw("Updating workflow checkpoint with message", "threadID", threadID, "sender", sender, "message", message)
	err := models.UpdateWorkflowCheckpointWithMessage(s.db, threadID, sender, message)
	if err != nil {
		workflowServiceLogger.Errorw("Failed to update workflow checkpoint with message", "threadID", threadID, "error", err)
		return fmt.Errorf("failed to update workflow checkpoint with message for thread ID %s: %w", threadID, err)
	}
	workflowServiceLogger.Debugw("Successfully updated workflow checkpoint with message", "threadID", threadID)
	return nil
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

/**
Note for tomorrow.it appears that by the first time we try to get a checkpoint. dayIndex is already 0 for the whole plan.
**/

// ListWorkflows returns a summary for the most recent N workflows.
// If limit <= 0, all workflows are returned.
func (s *workflowService) ListWorkflows(limit int) ([]models.WorkflowStatus, error) {
	workflowServiceLogger.Debugw("ListWorkflows called", "limit", limit)
	statuses, err := models.ListWorkflows(s.db, limit)
	if err != nil {
		workflowServiceLogger.Errorw("ListWorkflows failed", "error", err)
		return nil, err
	}
	return statuses, nil
}
