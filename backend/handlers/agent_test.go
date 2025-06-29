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
	originalDummy := UseDummy
	defer func() { UseDummy = originalDummy }()
	
	UseDummy = true // Use dummy mode to skip database operations
	var got []string
	agentCommandContext = fakeCommand(`{"success":true,"threadId":"id"}`, t, &got)

	reqBody := models.AgentStartRequest{Participants: []string{"brad"}, WorkflowType: "meal_planning"}
	b, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/agent/start", bytes.NewReader(b))
	rr := httptest.NewRecorder()
	StartAgentWorkflow(rr, req)
	if rr.Code != http.StatusNotImplemented {
		t.Fatalf("expected 501 got %d", rr.Code)
	}
}


