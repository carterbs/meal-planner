package models

import (
	"errors"
)

// AgentStartRequest represents a request to start a workflow
// Example JSON: {"participants":["brad","shannon"],"workflow_type":"meal_planning"}
type AgentStartRequest struct {
	Participants []string `json:"participants"`
	WorkflowType string   `json:"workflow_type"`
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

// AgentResponse is a generic response from the agent CLI
// Success indicates whether the command succeeded
// Message may contain a human readable message
// CurrentStep is the agent's workflow step
// MealPlan or other data may be embedded in Raw

type AgentResponse struct {
	Success     bool        `json:"success"`
	Message     string      `json:"message,omitempty"`
	ThreadID    string      `json:"threadId,omitempty"`
	CurrentStep string      `json:"current_step,omitempty"`
	Raw         interface{} `json:"raw,omitempty"`
}

// WorkflowStatus represents high level workflow info
// {"threadId":"uuid","workflow_type":"meal_planning","current_step":"step","participants":["brad"]}
type WorkflowStatus struct {
	ThreadID     string   `json:"threadId"`
	WorkflowType string   `json:"workflow_type"`
	CurrentStep  string   `json:"current_step"`
	Participants []string `json:"participants"`
}
