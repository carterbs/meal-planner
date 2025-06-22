package models

// WorkflowState represents the workflow status returned to clients
// additional fields may be added as needed
// e.g. meal plan or other state in raw JSON

type WorkflowState struct {
	ThreadID     string `json:"threadId"`
	WorkflowType string `json:"workflow_type,omitempty"`
	CurrentStep  string `json:"current_step,omitempty"`
	Status       string `json:"status,omitempty"`
}
