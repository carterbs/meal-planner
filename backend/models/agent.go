package models

import (
	"errors"
)

// AgentStartRequest represents a request to start a workflow
// Example JSON: {"participants":["brad","shannon"],"workflowType":"meal_planning"}
type AgentStartRequest struct {
	Participants []string `json:"participants"`
	WorkflowType string   `json:"workflowType"`
}

func (r *AgentStartRequest) Validate() error {
	if len(r.Participants) == 0 {
		return errors.New("participants required")
	}
	if r.WorkflowType == "" {
		return errors.New("workflow_type required")
	}
	return nil
}

// AgentFeedbackRequest represents feedback for a workflow
// Example JSON: {"threadId":"uuid","message":"text","from":"brad"}
type AgentFeedbackRequest struct {
	ThreadID string `json:"threadId"`
	Message  string `json:"message"`
	From     string `json:"from"`
}

func (r *AgentFeedbackRequest) Validate() error {
	if r.ThreadID == "" {
		return errors.New("threadId required")
	}
	if r.Message == "" {
		return errors.New("message required")
	}
	if r.From == "" {
		return errors.New("from required")
	}
	return nil
}

// AgentResumeRequest represents a resume request
// Example JSON: {"threadId":"uuid","interactive":false}
type AgentResumeRequest struct {
	ThreadID    string `json:"threadId"`
	Interactive bool   `json:"interactive"`
}

func (r *AgentResumeRequest) Validate() error {
	if r.ThreadID == "" {
		return errors.New("threadId required")
	}
	return nil
}

// AgentMessageRequest represents a combined feedback and resume request
// Example JSON: {"threadId":"uuid","message":"text","from":"user","interactive":false}
type AgentMessageRequest struct {
	ThreadID    string `json:"threadId"`
	Message     string `json:"message"`
	From        string `json:"from"`
	Interactive bool   `json:"interactive"`
}

// Validate ensures AgentMessageRequest has required fields
func (r *AgentMessageRequest) Validate() error {
	if r.ThreadID == "" {
		return errors.New("threadId required")
	}
	if r.Message == "" {
		return errors.New("message required")
	}
	if r.From == "" {
		return errors.New("from required")
	}
	return nil
}

// AgentResponse is a generic response from the agent CLI
// Success indicates whether the command succeeded
// Message may contain a human readable message
// CurrentStep is the agent's workflow step
// MealPlan or other data may be embedded in Raw

type AgentResponse struct {
	Success      bool        `json:"success"`
	Message      string      `json:"message,omitempty"`
	ThreadID     string      `json:"threadId,omitempty"`
	CurrentStep  string      `json:"currentStep,omitempty"`
	InitialState interface{} `json:"initialState,omitempty"`
	Raw          interface{} `json:"raw,omitempty"`
}

// WorkflowStatus represents high level workflow info
// {"threadId":"uuid","workflowType":"meal_planning","currentStep":"step","participants":["brad"]}
type WorkflowStatus struct {
	ThreadID     string   `json:"threadId"`
	WorkflowType string   `json:"workflowType"`
	CurrentStep  string   `json:"currentStep"`
	Participants []string `json:"participants"`
}
