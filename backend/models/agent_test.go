package models

import "testing"

func TestAgentStartRequestValidate(t *testing.T) {
	req := AgentStartRequest{}
	if err := ValidateAgentStartRequest(&req); err == nil {
		t.Error("expected error for empty request")
	}
	req.Participants = []string{"a"}
	req.WorkflowType = "meal_planning"
	if err := ValidateAgentStartRequest(&req); err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestAgentFeedbackRequestValidate(t *testing.T) {
	req := AgentFeedbackRequest{}
	if err := ValidateAgentFeedbackRequest(&req); err == nil {
		t.Error("expected error for empty request")
	}
	req.ThreadId = "id"
	req.Message = "msg"
	req.From = "brad"
	if err := ValidateAgentFeedbackRequest(&req); err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestAgentResumeRequestValidate(t *testing.T) {
	req := AgentResumeRequest{}
	if err := ValidateAgentResumeRequest(&req); err == nil {
		t.Error("expected error for empty request")
	}
	req.ThreadId = "id"
	if err := ValidateAgentResumeRequest(&req); err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestAgentMessageRequestValidate(t *testing.T) {
	req := AgentMessageRequest{}
	if err := ValidateAgentMessageRequest(&req); err == nil {
		t.Error("expected error for empty request")
	}
	req.ThreadId = "id"
	req.Message = "hello"
	req.From = "brad"
	if err := ValidateAgentMessageRequest(&req); err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}
