package models

import "testing"

func TestAgentStartRequestValidate(t *testing.T) {
	req := AgentStartRequest{}
	if err := req.Validate(); err == nil {
		t.Error("expected error for empty request")
	}
	req.Participants = []string{"a"}
	req.WorkflowType = "meal_planning"
	if err := req.Validate(); err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestAgentFeedbackRequestValidate(t *testing.T) {
	req := AgentFeedbackRequest{}
	if err := req.Validate(); err == nil {
		t.Error("expected error for empty request")
	}
	req.ThreadID = "id"
	req.Message = "msg"
	req.From = "brad"
	if err := req.Validate(); err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestAgentResumeRequestValidate(t *testing.T) {
	req := AgentResumeRequest{}
	if err := req.Validate(); err == nil {
		t.Error("expected error for empty request")
	}
	req.ThreadID = "id"
	if err := req.Validate(); err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestAgentMessageRequestValidate(t *testing.T) {
	req := AgentMessageRequest{}
	if err := req.Validate(); err == nil {
		t.Error("expected error for empty request")
	}
	req.ThreadID = "id"
	req.Message = "hello"
	req.From = "brad"
	if err := req.Validate(); err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}
