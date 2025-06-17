package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"testing"

	"mealplanner/models"
)

func fakeCommand(output string, t *testing.T, gotArgs *[]string) func(ctx context.Context, name string, args ...string) *exec.Cmd {
	return func(ctx context.Context, name string, args ...string) *exec.Cmd {
		*gotArgs = append([]string{name}, args...)
		return exec.CommandContext(ctx, "echo", output)
	}
}

func TestStartAgentWorkflow(t *testing.T) {
	originalCmd := agentCommandContext
	defer func() { agentCommandContext = originalCmd }()
	UseDummy = false
	var got []string
	agentCommandContext = fakeCommand(`{"success":true,"threadId":"id"}`, t, &got)

	reqBody := models.AgentStartRequest{Participants: []string{"brad"}, WorkflowType: "meal_planning"}
	b, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/agent/start", bytes.NewReader(b))
	rr := httptest.NewRecorder()
	StartAgentWorkflow(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 got %d", rr.Code)
	}
	var resp models.AgentResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !resp.Success || resp.ThreadID != "id" {
		t.Fatalf("unexpected resp %+v", resp)
	}
	if len(got) == 0 {
		t.Fatal("expected command execution")
	}
}

func TestAddAgentFeedback(t *testing.T) {
	originalCmd := agentCommandContext
	defer func() { agentCommandContext = originalCmd }()
	UseDummy = false
	var got []string
	agentCommandContext = fakeCommand(`{"success":true}`, t, &got)
	reqBody := models.AgentFeedbackRequest{ThreadID: "id", Message: "hi", From: "brad"}
	b, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/agent/feedback", bytes.NewReader(b))
	rr := httptest.NewRecorder()
	AddAgentFeedback(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 got %d", rr.Code)
	}
	if len(got) == 0 {
		t.Fatal("expected command execution")
	}
}

func TestResumeAgentWorkflow(t *testing.T) {
	originalCmd := agentCommandContext
	defer func() { agentCommandContext = originalCmd }()
	UseDummy = false
	var got []string
	agentCommandContext = fakeCommand(`{"success":true}`, t, &got)
	reqBody := models.AgentResumeRequest{ThreadID: "id"}
	b, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/agent/resume", bytes.NewReader(b))
	rr := httptest.NewRecorder()
	ResumeAgentWorkflow(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 got %d", rr.Code)
	}
	if len(got) == 0 {
		t.Fatal("expected command execution")
	}
}
