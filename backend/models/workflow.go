package models

import (
	"encoding/json"
	"time"
)

// FeedbackEntry represents user feedback in the workflow
type FeedbackEntry struct {
	From            string `json:"from"`
	Message         string `json:"message"`
	Timestamp       string `json:"timestamp"`
	MealPlanVersion int    `json:"meal_plan_version"`
}

// CheckpointData represents the top-level structure stored in workflow_checkpoints.
// The canonical field for the workflow state is now `state`. The legacy
// `channel_values` key is kept for backwards-compatibility and migrated to the
// new field on load so that older checkpoints continue to work.
type CheckpointData struct {
	Next          []interface{}         `json:"next"`
	Step          int                   `json:"step"`
	State         InternalWorkflowState `json:"state"`
	ChannelValues InternalWorkflowState `json:"channel_values,omitempty"`
}

// InternalWorkflowState represents the workflow state stored in channel_values (internal format)
type AgentMessage struct {
	Sender    string `json:"sender"`
	Text      string `json:"text"`
	Timestamp string `json:"timestamp"`
}

type InternalWorkflowState struct {
	ThreadID              string             `json:"threadId"`
	WorkflowType          string             `json:"workflow_type"`
	MealPlan              *WeeklyMealPlan    `json:"meal_plan"`
	FeedbackHistory       []FeedbackEntry    `json:"feedback_history"`
	AgentMessages         []AgentMessage     `json:"agent_messages"`
	CurrentStep           string             `json:"current_step"`
	IsFinalized           bool               `json:"is_finalized"`
	Participants          []string           `json:"participants"`
	ShoppingList          []ShoppingListItem `json:"shopping_list"`
	IterationCount        int                `json:"iteration_count"`
	CreatedAt             time.Time          `json:"created_at"`
	UpdatedAt             time.Time          `json:"updated_at"`
	UserMessage           *string            `json:"user_message,omitempty"`
	LastFeedbackAppliedAt *string            `json:"last_feedback_applied_at,omitempty"`
	ShoppingListFormatted *string            `json:"shopping_list_formatted,omitempty"`
	Error                 *string            `json:"_error,omitempty"`
}

// WorkflowState represents the complete workflow status returned to clients
// includes all session data for full state restoration
type WorkflowState struct {
	ThreadID     string          `json:"threadId"`
	WorkflowType string          `json:"workflow_type,omitempty"`
	CurrentStep  string          `json:"current_step,omitempty"`
	Status       string          `json:"status,omitempty"`
	Messages     []ChatMessage   `json:"messages,omitempty"`
	MealPlan     json.RawMessage `json:"meal_plan,omitempty"`
	ShoppingList json.RawMessage `json:"shopping_list,omitempty"`
	CreatedAt    time.Time       `json:"created_at,omitempty"`
	UpdatedAt    time.Time       `json:"updated_at,omitempty"`
}

// ParseCheckpointData parses raw checkpoint bytes into a structured CheckpointData.
// If the legacy `channel_values` key is present, its contents are migrated to
// the canonical `state` field so that callers can rely on `State` being
// populated.
func ParseCheckpointData(data []byte) (*CheckpointData, error) {
	var checkpoint CheckpointData
	if err := json.Unmarshal(data, &checkpoint); err != nil {
		return nil, err
	}
	// Migrate legacy data
	if checkpoint.State.ThreadID == "" && checkpoint.ChannelValues.ThreadID != "" {
		checkpoint.State = checkpoint.ChannelValues
	}
	// If State is still empty, attempt a secondary unmarshal assuming snake_case JSON from proto checkpoints
	if checkpoint.State.ThreadID == "" {
		var raw struct {
			State json.RawMessage `json:"state"`
		}
		if err2 := json.Unmarshal(data, &raw); err2 == nil && raw.State != nil {
			// Define a shadow struct with snake_case tags to map protojson output
			type protoState struct {
				ThreadID     string   `json:"thread_id"`
				WorkflowType string   `json:"workflow_type"`
				Participants []string `json:"participants"`
				CurrentStep  string   `json:"current_step"`
				MealPlan     any      `json:"meal_plan"`
				FeedbackHistory any   `json:"feedback_history"`
				IterationCount int    `json:"iteration_count"`
				ShoppingList   any    `json:"shopping_list"`
				IsFinalized    bool   `json:"is_finalized"`
				CreatedAt      time.Time `json:"created_at"`
				UpdatedAt      time.Time `json:"updated_at"`
			}
			var ps protoState
			if err3 := json.Unmarshal(raw.State, &ps); err3 == nil && ps.ThreadID != "" {
				checkpoint.State.ThreadID = ps.ThreadID
				checkpoint.State.WorkflowType = ps.WorkflowType
				checkpoint.State.Participants = ps.Participants
				checkpoint.State.CurrentStep = ps.CurrentStep
				checkpoint.State.MealPlan = nil // could map if needed
				checkpoint.State.FeedbackHistory = nil // likewise
				checkpoint.State.IterationCount = ps.IterationCount
				checkpoint.State.ShoppingList = nil
				checkpoint.State.IsFinalized = ps.IsFinalized
				checkpoint.State.CreatedAt = ps.CreatedAt
				checkpoint.State.UpdatedAt = ps.UpdatedAt
			}
		}
	}
	// Ensure workflow_type has a default value if still empty
	if checkpoint.State.WorkflowType == "" {
		checkpoint.State.WorkflowType = "meal_planning"
	}
	return &checkpoint, nil
}

// MarshalCheckpointData marshals CheckpointData back to bytes
func (cd *CheckpointData) MarshalCheckpointData() ([]byte, error) {
	return json.Marshal(cd)
}
