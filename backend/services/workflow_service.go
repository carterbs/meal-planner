package services

import (
	"database/sql"
	"fmt"
	"time"

	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/types/known/timestamppb"

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
	state.UpdatedAt = timestamppb.New(time.Now())

	// 3. Update checkpoint as before
	return s.UpdateWorkflowState(threadID, state)
}

// GetWorkflowState retrieves the complete workflow state for a thread
func (s *workflowService) GetWorkflowState(threadID string) (*apipb.MealPlanningCheckpointState, error) {
	checkpointData, _, err := models.GetWorkflowCheckpoint(s.db, threadID)
	if err != nil {
		return nil, fmt.Errorf("failed to get checkpoint: %w", err)
	}
	if checkpointData == nil {
		return nil, fmt.Errorf("no checkpoint found for thread %s", threadID)
	}

	// Parse the checkpoint data directly as AgentCheckpoint
	var fullCheckpoint apipb.AgentCheckpoint
	um := protojson.UnmarshalOptions{DiscardUnknown: true}
	if err := um.Unmarshal(checkpointData, &fullCheckpoint); err != nil {
		return nil, fmt.Errorf("failed to unmarshal checkpoint: %w", err)
	}

	if fullCheckpoint.State == nil {
		return nil, fmt.Errorf("checkpoint has no state for thread %s", threadID)
	}

	return fullCheckpoint.State, nil
}

// UpdateWorkflowState updates the complete workflow state for a thread
func (s *workflowService) UpdateWorkflowState(threadID string, state *apipb.MealPlanningCheckpointState) error {
	// Get the existing checkpoint structure to preserve the wrapper
	checkpointData, _, err := models.GetWorkflowCheckpoint(s.db, threadID)
	if err != nil {
		return fmt.Errorf("failed to get existing checkpoint: %w", err)
	}
	if checkpointData == nil {
		return fmt.Errorf("no existing checkpoint found for thread %s", threadID)
	}

	// Parse the existing checkpoint
	var fullCheckpoint apipb.AgentCheckpoint
	um := protojson.UnmarshalOptions{DiscardUnknown: true}
	if err := um.Unmarshal(checkpointData, &fullCheckpoint); err != nil {
		return fmt.Errorf("failed to parse existing checkpoint: %w", err)
	}

	// Update the state while preserving other checkpoint fields
	fullCheckpoint.State = state

	// Marshal back to bytes using protojson for consistency
	marshalOpts := protojson.MarshalOptions{UseProtoNames: true}
	finalCheckpointBytes, err := marshalOpts.Marshal(&fullCheckpoint)
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
	
	// Parse timestamp into protobuf timestamp
	parsedTime, err := time.Parse(time.RFC3339, timestamp)
	if err != nil {
		return fmt.Errorf("failed to parse timestamp: %w", err)
	}
	
	// Create new feedback entry using protobuf types
	newFeedback := &apipb.FeedbackEntryProto{
		From:      from,
		Message:   message,
		Timestamp: timestamppb.New(parsedTime),
		MealPlanVersion: 0, // You may need to set this appropriately
	}
	
	state.FeedbackHistory = append(state.FeedbackHistory, newFeedback)
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
// NOTE: AgentMessages field is not part of the current protobuf schema
// This function is temporarily disabled to focus on the main checkpoint issue
func (s *workflowService) AddAgentMessage(threadID, text, timestamp string) error {
	workflowServiceLogger.Debugw("AddAgentMessage: Temporarily disabled - field not in protobuf schema", "threadID", threadID)
	// TODO: Either add agent_messages to the protobuf schema or handle this differently
	return nil
}

// AddMessage adds a message to the messages table
func (s *workflowService) AddMessage(threadID, sender, message string) (*models.ChatMessage, error) {
	workflowServiceLogger.Debugw("Adding message to messages table", "threadID", threadID, "sender", sender)
	err := models.AddMessage(s.db, threadID, sender, message)
	if err != nil {
		workflowServiceLogger.Errorw("Failed to add message", "threadID", threadID, "sender", sender, "error", err)
		return nil, fmt.Errorf("failed to add message for thread ID %s: %w", threadID, err)
	}
	msg := &models.ChatMessage{Sender: sender, Text: message}
	workflowServiceLogger.Debugw("Successfully added message", "threadID", threadID, "sender", sender)
	return msg, nil
}

// UpdateWorkflowCheckpointWithMessage adds a message to the messages table
func (s *workflowService) UpdateWorkflowCheckpointWithMessage(threadID, sender, message string) error {
	workflowServiceLogger.Debugw("Adding message to messages table", "threadID", threadID, "sender", sender, "message", message)
	err := models.AddMessage(s.db, threadID, sender, message)
	if err != nil {
		workflowServiceLogger.Errorw("Failed to add message", "threadID", threadID, "error", err)
		return fmt.Errorf("failed to add message for thread ID %s: %w", threadID, err)
	}
	workflowServiceLogger.Debugw("Successfully added message to messages table", "threadID", threadID)
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
