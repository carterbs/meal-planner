package models

import (
	"time"
)

// LastPlannedMeals represents the last planned meals for each meal type
type LastPlannedMeals struct {
	BreakfastMeals []*Meal `json:"breakfast_meals"`
	LunchMeals     []*Meal `json:"lunch_meals"`
	DinnerMeals    []*Meal `json:"dinner_meals"`
}

// WorkflowCheckpoint represents a workflow checkpoint
type WorkflowCheckpoint struct {
	ThreadID       string    `json:"thread_id"`
	WorkflowType   string    `json:"workflow_type"`
	Namespace      string    `json:"namespace"`
	CheckpointData []byte    `json:"checkpoint_data"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// WorkflowSummary represents a workflow summary for listing
type WorkflowSummary struct {
	ThreadID     string    `json:"thread_id"`
	WorkflowType string    `json:"workflow_type"`
	CurrentStep  string    `json:"current_step"`
	Participants []string  `json:"participants"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// CheckpointData represents checkpoint data for storage
type CheckpointData struct {
	ThreadID       string                 `json:"thread_id"`
	Namespace      string                 `json:"namespace"`
	CheckpointData []byte                 `json:"checkpoint_data"`
	Metadata       map[string]interface{} `json:"metadata"`
}

// CheckpointSummary represents checkpoint summary information
type CheckpointSummary struct {
	ThreadID     string                 `json:"thread_id"`
	Namespace    string                 `json:"namespace"`
	WorkflowType string                 `json:"workflow_type"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
	Metadata     map[string]interface{} `json:"metadata"`
}

