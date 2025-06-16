package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os/exec"
	"time"

	"mealplanner/models"

	"github.com/go-chi/chi/v5"
)

var agentCommandContext = exec.CommandContext

// runAgentCLI executes the agent CLI with given args and unmarshals JSON output into resp
func runAgentCLI(ctx context.Context, args ...string) (models.AgentResponse, error) {
	cmd := agentCommandContext(ctx, "node", append([]string{"agent/dist/cli.js"}, args...)...)
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	if err := cmd.Run(); err != nil {
		return models.AgentResponse{}, errors.New(out.String())
	}
	var resp models.AgentResponse
	if err := json.Unmarshal(out.Bytes(), &resp); err != nil {
		return models.AgentResponse{}, err
	}
	return resp, nil
}

// StartAgentWorkflow handles POST /api/agent/start
func StartAgentWorkflow(w http.ResponseWriter, r *http.Request) {
	if UseDummy {
		http.Error(w, "Not implemented in dummy mode", http.StatusNotImplemented)
		return
	}
	var req models.AgentStartRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if err := req.Validate(); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	resp, err := runAgentCLI(ctx, "plan", "start", "--participants", joinParticipants(req.Participants))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, resp)
}

func joinParticipants(p []string) string {
	if len(p) == 0 {
		return ""
	}
	s := p[0]
	for _, v := range p[1:] {
		s += "," + v
	}
	return s
}

// AddAgentFeedback handles POST /api/agent/feedback
func AddAgentFeedback(w http.ResponseWriter, r *http.Request) {
	if UseDummy {
		http.Error(w, "Not implemented in dummy mode", http.StatusNotImplemented)
		return
	}
	var req models.AgentFeedbackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if err := req.Validate(); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	resp, err := runAgentCLI(ctx, "plan", "feedback", req.ThreadID, req.Message, "--from", req.From)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, resp)
}

// ResumeAgentWorkflow handles POST /api/agent/resume
func ResumeAgentWorkflow(w http.ResponseWriter, r *http.Request) {
	if UseDummy {
		http.Error(w, "Not implemented in dummy mode", http.StatusNotImplemented)
		return
	}
	var req models.AgentResumeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if err := req.Validate(); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	args := []string{"resume", req.ThreadID}
	if req.Interactive {
		args = append(args, "--interactive")
	}
	resp, err := runAgentCLI(ctx, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, resp)
}

// GetWorkflowStatus handles GET /api/agent/status/{threadId}
func GetWorkflowStatus(w http.ResponseWriter, r *http.Request) {
	if UseDummy {
		http.Error(w, "Not implemented in dummy mode", http.StatusNotImplemented)
		return
	}
	threadID := chi.URLParam(r, "threadId")
	if threadID == "" {
		http.Error(w, "missing thread id", http.StatusBadRequest)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	resp, err := runAgentCLI(ctx, "status", threadID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, resp)
}

// ListWorkflows handles GET /api/agent/workflows
func ListWorkflows(w http.ResponseWriter, r *http.Request) {
	if UseDummy {
		http.Error(w, "Not implemented in dummy mode", http.StatusNotImplemented)
		return
	}
	workflowType := r.URL.Query().Get("type")
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	args := []string{"list"}
	if workflowType != "" {
		args = append(args, "--type", workflowType)
	}
	resp, err := runAgentCLI(ctx, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, resp)
}

// CancelWorkflow handles DELETE /api/agent/workflows/{threadId}
func CancelWorkflow(w http.ResponseWriter, r *http.Request) {
	if UseDummy {
		http.Error(w, "Not implemented in dummy mode", http.StatusNotImplemented)
		return
	}
	threadID := chi.URLParam(r, "threadId")
	if threadID == "" {
		http.Error(w, "missing thread id", http.StatusBadRequest)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	resp, err := runAgentCLI(ctx, "cancel", threadID, "--force")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, resp)
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	enc := json.NewEncoder(w)
	enc.Encode(v)
}
