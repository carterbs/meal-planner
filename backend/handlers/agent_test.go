package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
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
	req := httptest.NewRequest("POST", "/api/agent/feedback", bytes.NewBufferString("{}"))
	rr := httptest.NewRecorder()
	AddAgentFeedback(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 got %d", rr.Code)
	}
}

func TestResumeAgentWorkflowDummyMode(t *testing.T) {
	req := httptest.NewRequest("POST", "/api/agent/resume", bytes.NewBufferString("{}"))
	rr := httptest.NewRecorder()
	ResumeAgentWorkflow(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 got %d", rr.Code)
	}
}

func TestMessageAgentHandlerDummyMode(t *testing.T) {
	req := httptest.NewRequest("POST", "/api/agent/message", bytes.NewBufferString("{}"))
	rr := httptest.NewRecorder()
	MessageAgentHandler(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 got %d", rr.Code)
	}
}

func TestGetWorkflowStatusDummyMode(t *testing.T) {
	helper := setupTest(t)
	
	// Mock the workflow service call
	helper.mock.ExpectQuery(".*").WillReturnRows(sqlmock.NewRows([]string{}))
	
	req := httptest.NewRequest("GET", "/api/agent/status/1", nil)
	rr := httptest.NewRecorder()
	r := chi.NewRouter()
	r.Get("/api/agent/status/{threadId}", GetWorkflowStatus)
	r.ServeHTTP(rr, req)
	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 got %d", rr.Code)
	}
}

func TestCancelWorkflowDummyMode(t *testing.T) {
	helper := setupTest(t)
	
	// CancelWorkflow calls models.UpdateWorkflowCheckpointWithMessage which first queries for existing checkpoint
	helper.mock.ExpectQuery("SELECT checkpoint_data, checkpoint_ns FROM workflow_checkpoints").
		WithArgs("1").
		WillReturnRows(sqlmock.NewRows([]string{"checkpoint_data", "checkpoint_ns"}).
			AddRow(`{"test": "data"}`, "latest"))
	
	// Then it updates the checkpoint
	helper.mock.ExpectExec("INSERT INTO workflow_checkpoints").
		WithArgs("1", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))
	
	req := httptest.NewRequest("DELETE", "/api/agent/workflows/1", nil)
	rr := httptest.NewRecorder()
	r := chi.NewRouter()
	r.Delete("/api/agent/workflows/{threadId}", CancelWorkflow)
	r.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 got %d", rr.Code)
	}
}
