package models

import (
	"encoding/json"
	"time"
)

// FeedbackEntry represents user feedback in the workflow
type FeedbackEntry struct {
	From              string `json:"from"`
	Message           string `json:"message"`
	Timestamp         string `json:"timestamp"`
	MealPlanVersion   int    `json:"meal_plan_version"`
}

// CheckpointData represents the top-level structure stored in workflow_checkpoints
type CheckpointData struct {
	Next          []interface{}     `json:"next"`
	Step          int               `json:"step"`
	ChannelValues InternalWorkflowState `json:"channel_values"`
}

// InternalWorkflowState represents the workflow state stored in channel_values (internal format)
type InternalWorkflowState struct {
	ThreadID                string              `json:"threadId"`
	WorkflowType           string              `json:"workflow_type"`
	MealPlan               *WeeklyMealPlan     `json:"meal_plan"`
	FeedbackHistory        []FeedbackEntry     `json:"feedback_history"`
	CurrentStep            string              `json:"current_step"`
	IsFinalized            bool                `json:"is_finalized"`
	Participants           []string            `json:"participants"`
	ShoppingList           []ShoppingListItem  `json:"shopping_list"`
	IterationCount         int                 `json:"iteration_count"`
	CreatedAt              time.Time           `json:"created_at"`
	UpdatedAt              time.Time           `json:"updated_at"`
	UserMessage            *string             `json:"user_message,omitempty"`
	LastFeedbackAppliedAt  *string             `json:"last_feedback_applied_at,omitempty"`
	ShoppingListFormatted  *string             `json:"shopping_list_formatted,omitempty"`
	Error                  *string             `json:"_error,omitempty"`
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

// ParseCheckpointData parses raw checkpoint bytes into a structured CheckpointData
func ParseCheckpointData(data []byte) (*CheckpointData, error) {
	var checkpoint CheckpointData
	if err := json.Unmarshal(data, &checkpoint); err != nil {
		return nil, err
	}
	return &checkpoint, nil
}

// MarshalCheckpointData marshals CheckpointData back to bytes
func (cd *CheckpointData) MarshalCheckpointData() ([]byte, error) {
	return json.Marshal(cd)
}
