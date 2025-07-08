package models

import (
	"errors"

	apipb "mealplanner/generated/go"
)

// AgentStartRequest represents a request to start a workflow
// Example JSON: {"participants":["brad","shannon"],"workflowType":"meal_planning"}
// AgentStartRequest aliases the protobuf message
type AgentStartRequest = apipb.AgentStartRequest

func ValidateAgentStartRequest(r *apipb.AgentStartRequest) error {
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
// AgentFeedbackRequest aliases the protobuf message
type AgentFeedbackRequest = apipb.AgentFeedbackRequest

func ValidateAgentFeedbackRequest(r *apipb.AgentFeedbackRequest) error {
	if r.ThreadId == "" {
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
// AgentResumeRequest aliases the protobuf message
type AgentResumeRequest = apipb.AgentResumeRequest

func ValidateAgentResumeRequest(r *apipb.AgentResumeRequest) error {
	if r.ThreadId == "" {
		return errors.New("threadId required")
	}
	return nil
}

// AgentMessageRequest represents a combined feedback and resume request
// Example JSON: {"threadId":"uuid","message":"text","from":"user","interactive":false}
// AgentMessageRequest aliases the protobuf message
type AgentMessageRequest = apipb.AgentMessageRequest

// Validate ensures AgentMessageRequest has required fields
func ValidateAgentMessageRequest(r *apipb.AgentMessageRequest) error {
	if r.ThreadId == "" {
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

// AgentResponse aliases the protobuf message
type AgentResponse = apipb.AgentResponse

// WorkflowStatus represents high level workflow info
// {"threadId":"uuid","workflowType":"meal_planning","currentStep":"step","participants":["brad"]}
// WorkflowStatus aliases the protobuf message
type WorkflowStatus = apipb.WorkflowStatus
