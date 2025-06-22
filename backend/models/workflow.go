package models

// WorkflowStatus indicates overall workflow lifecycle state
const (
	WorkflowStatusActive    = "ACTIVE"
	WorkflowStatusAbandoned = "ABANDONED"
)

type WorkflowState struct {
	ThreadID     string `json:"threadId"`
	WorkflowType string `json:"workflow_type"`
	CurrentStep  string `json:"current_step"`
	Status       string `json:"status"`
}
