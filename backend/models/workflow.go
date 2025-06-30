package models

import (
	"encoding/json"
	"time"
)

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
