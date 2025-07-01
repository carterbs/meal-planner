package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"testing"

	"github.com/go-chi/chi/v5"
	"mealplanner/models"
)

func fakeCommand(output string, _ *testing.T, gotArgs *[]string) func(ctx context.Context, name string, args ...string) *exec.Cmd {
	return func(ctx context.Context, name string, args ...string) *exec.Cmd {
		if gotArgs != nil {
			*gotArgs = append([]string{name}, args...)
		}
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

func fakeFailCommand(_ string, _ *testing.T, _ *[]string) func(ctx context.Context, name string, args ...string) *exec.Cmd {
	return func(ctx context.Context, name string, args ...string) *exec.Cmd {
		return exec.CommandContext(ctx, "sh", "-c", "echo fail && exit 1")
	}
}

func fakeInvalidJSONCommand(_ string, _ *testing.T, _ *[]string) func(ctx context.Context, name string, args ...string) *exec.Cmd {
	return func(ctx context.Context, name string, args ...string) *exec.Cmd {
		return exec.CommandContext(ctx, "echo", "notjson")
	}
}

func TestRunAgentCLI(t *testing.T) {
	originalCmd := agentCommandContext
	defer func() { agentCommandContext = originalCmd }()

	t.Run("success", func(t *testing.T) {
		agentCommandContext = fakeCommand(`{"success":true}`, t, nil)
		resp, err := runAgentCLI(context.Background(), "test")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !resp.Success {
			t.Errorf("expected success")
		}
	})

	t.Run("command error", func(t *testing.T) {
		agentCommandContext = fakeFailCommand("", t, nil)
		_, err := runAgentCLI(context.Background(), "bad")
		if err == nil {
			t.Fatalf("expected error")
		}
	})

	t.Run("json parse error", func(t *testing.T) {
		agentCommandContext = fakeInvalidJSONCommand("", t, nil)
		_, err := runAgentCLI(context.Background(), "badjson")
		if err == nil {
			t.Fatalf("expected error")
		}
	})
}

func TestJoinParticipants(t *testing.T) {
	if joinParticipants(nil) != "" {
		t.Errorf("expected empty string for nil slice")
	}
	out := joinParticipants([]string{"a", "b", "c"})
	if out != "a,b,c" {
		t.Errorf("unexpected output: %s", out)
	}
}

func TestAddAgentFeedbackDummyMode(t *testing.T) {
	originalDummy := UseDummy
	UseDummy = true
	defer func() { UseDummy = originalDummy }()

	req := httptest.NewRequest("POST", "/api/agent/feedback", bytes.NewBufferString("{}"))
	rr := httptest.NewRecorder()
	AddAgentFeedback(rr, req)
	if rr.Code != http.StatusNotImplemented {
		t.Fatalf("expected 501 got %d", rr.Code)
	}
}

func TestResumeAgentWorkflowDummyMode(t *testing.T) {
	originalDummy := UseDummy
	UseDummy = true
	defer func() { UseDummy = originalDummy }()

	req := httptest.NewRequest("POST", "/api/agent/resume", bytes.NewBufferString("{}"))
	rr := httptest.NewRecorder()
	ResumeAgentWorkflow(rr, req)
	if rr.Code != http.StatusNotImplemented {
		t.Fatalf("expected 501 got %d", rr.Code)
	}
}

func TestMessageAgentHandlerDummyMode(t *testing.T) {
	originalDummy := UseDummy
	UseDummy = true
	defer func() { UseDummy = originalDummy }()

	req := httptest.NewRequest("POST", "/api/agent/message", bytes.NewBufferString("{}"))
	rr := httptest.NewRecorder()
	MessageAgentHandler(rr, req)
	if rr.Code != http.StatusNotImplemented {
		t.Fatalf("expected 501 got %d", rr.Code)
	}
}

func TestGetWorkflowStatusDummyMode(t *testing.T) {
	originalDummy := UseDummy
	UseDummy = true
	defer func() { UseDummy = originalDummy }()

	req := httptest.NewRequest("GET", "/api/agent/status/1", nil)
	rr := httptest.NewRecorder()
	r := chi.NewRouter()
	r.Get("/api/agent/status/{threadId}", GetWorkflowStatus)
	r.ServeHTTP(rr, req)
	if rr.Code != http.StatusNotImplemented {
		t.Fatalf("expected 501 got %d", rr.Code)
	}
}

func TestCancelWorkflowDummyMode(t *testing.T) {
	originalDummy := UseDummy
	UseDummy = true
	defer func() { UseDummy = originalDummy }()

	req := httptest.NewRequest("DELETE", "/api/agent/workflows/1", nil)
	rr := httptest.NewRecorder()
	r := chi.NewRouter()
	r.Delete("/api/agent/workflows/{threadId}", CancelWorkflow)
	r.ServeHTTP(rr, req)
	if rr.Code != http.StatusNotImplemented {
		t.Fatalf("expected 501 got %d", rr.Code)
	}
}
