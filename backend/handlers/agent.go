package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"time"

	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	"mealplanner/logging"
	"mealplanner/models"

	"github.com/go-chi/chi/v5"
)

var agentCommandContext = exec.CommandContext
var logger = logging.GetGrpcLogger("agent-handler")

// runAgentCLI executes the agent CLI with given args and unmarshals JSON output into resp
func runAgentCLI(ctx context.Context, args ...string) (models.AgentResponse, error) {
	// Always add --json flag for API integration
	allArgs := append([]string{"../typescript/agent/dist/cli.js", "--json"}, args...)
	// Record the start time for profiling
	startTime := time.Now()
	logger.Debugw("Executing agent CLI command", "args", allArgs)

	cmd := agentCommandContext(ctx, "node", allArgs...)
	var stdoutBuffer, stderrBuffer bytes.Buffer
	cmd.Stdout = &stdoutBuffer
	cmd.Stderr = &stderrBuffer

	err := cmd.Run()
	duration := time.Since(startTime)
	logger.Debugw("Agent CLI command completed", "duration", duration)

	if err != nil {
		// Combine stderr and stdout in the error message for comprehensive debugging info
		errMsg := "agent CLI execution failed: " + err.Error()
		if stderrBuffer.Len() > 0 {
			errMsg += "\nStderr: " + stderrBuffer.String()
		}
		if stdoutBuffer.Len() > 0 {
			errMsg += "\nStdout: " + stdoutBuffer.String()
		}
		logger.Errorw("Agent CLI execution failed", "error", errMsg)
		return models.AgentResponse{}, fmt.Errorf("%s", errMsg)
	}

	// Log the buffers before attempting to unmarshal stdout
	logger.Debugw("Agent CLI stderr", "stderr", stderrBuffer.String())
	logger.Debugw("Agent CLI stdout", "stdout", stdoutBuffer.String())

	// Attempt to unmarshal stdout only
	var resp models.AgentResponse
	if err := json.Unmarshal(stdoutBuffer.Bytes(), &resp); err != nil {
		// If unmarshal fails, return an error including the stdout that failed to parse
		return models.AgentResponse{}, fmt.Errorf("failed to unmarshal agent response: %v\nStdout: %s", err, stdoutBuffer.String()) // Include stdoutBuffer for context
	}
	return resp, nil
}

// StartAgentWorkflow handles POST /api/agent/start
func StartAgentWorkflow(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}
	var req models.AgentStartRequest
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if err := req.Validate(); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	resp, err := runAgentCLI(ctx, "plan", "start", "--participants", joinParticipants(req.Participants))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Initialize workflow checkpoint
	if resp.ThreadID == "" {
		http.Error(w, "failed to start workflow: missing thread ID", http.StatusInternalServerError)
		logger.Errorw("No thread ID returned from agent CLI on start", "req", req)
		return
	}
	// Seed full workflow state into checkpoint
	if resp.InitialState != nil {
		checkpoint := map[string]interface{}{
			"channel_values": resp.InitialState,
			"next":           []interface{}{},
			"step":           0,
		}
		if data, err := json.Marshal(checkpoint); err != nil {
			logger.Errorw("Failed to serialize initial checkpoint", "error", err)
		} else if err := Services.WorkflowService.UpdateWorkflowCheckpoint(resp.ThreadID, data); err != nil {
			logger.Errorw("Failed to initialize workflow checkpoint", "error", err)
		}
	}
	// Add initial agent message if present
	if resp.Message != "" {
		t := time.Now().Format(time.RFC3339) // use current local time
		if err := Services.WorkflowService.AddAgentMessage(resp.ThreadID, resp.Message, t); err != nil {
			logger.Errorw("Failed to add agent message", "error", err)
		}
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
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}
	var req models.AgentFeedbackRequest
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if err := req.Validate(); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Store user message in database
	if req.From == "user" && req.Message != "" {
		_, err := Services.WorkflowService.AddMessage(req.ThreadID, "user", req.Message)
		if err != nil {
			logger.Infof("[ERROR AddAgentFeedback] Failed to store user message: %v", err)
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	logger.Infof("[DEBUG AddAgentFeedback] Running agent CLI: plan feedback %s %s --from %s", req.ThreadID, req.Message, req.From)
	resp, err := runAgentCLI(ctx, "plan", "feedback", req.ThreadID, req.Message, "--from", req.From)
	if err != nil {
		logger.Infof("[ERROR AddAgentFeedback] agent CLI error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	logger.Infof("[DEBUG AddAgentFeedback] agent CLI response: %+v", resp)

	// Append agent message to workflow checkpoint
	if resp.Message != "" {
		t := time.Now().Format(time.RFC3339) // use current local time
		if err := Services.WorkflowService.AddAgentMessage(req.ThreadID, resp.Message, t); err != nil {
			logger.Infof("[ERROR AddAgentFeedback] Failed to add agent message: %v", err)
		}
	}

	writeJSON(w, resp)
}

// ResumeAgentWorkflow handles POST /api/agent/resume
func ResumeAgentWorkflow(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}
	var req models.AgentResumeRequest
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if err := req.Validate(); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
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

	if resp.ThreadID == "" {
		http.Error(w, "failed to resume workflow: missing thread ID", http.StatusInternalServerError)
		logger.Errorw("No thread ID returned from agent CLI on resume", "req", req)
		return
	}
	// Merge updated data into workflow checkpoint
	m := map[string]interface{}{}
	// load existing checkpoint
	if raw, _, err := Services.WorkflowService.GetWorkflowCheckpoint(resp.ThreadID); err == nil {
		json.Unmarshal(raw, &m)
	}
	if resp.Raw != nil {
		if rawMap, ok := resp.Raw.(map[string]interface{}); ok {
			if mealPlan, ok := rawMap["meal_plan"]; ok {
				m["meal_plan"] = mealPlan
			}
			if shoppingList, ok := rawMap["shopping_list_formatted"].(string); ok {
				m["shopping_list"] = shoppingList
			}
		}
	}
	if data, err := json.Marshal(m); err != nil {
		logger.Errorw("Failed to serialize updated checkpoint", "error", err)
	} else {
		if err := Services.WorkflowService.UpdateWorkflowCheckpoint(resp.ThreadID, data); err != nil {
			logger.Errorw("Failed to update workflow checkpoint", "error", err)
		}
	}
	// Add agent message if present
	if resp.Message != "" {
		t := time.Now().Format(time.RFC3339) // use current local time
		if err := Services.WorkflowService.AddAgentMessage(resp.ThreadID, resp.Message, t); err != nil {
			logger.Errorw("Failed to add agent message", "error", err)
		}
	}

	writeJSON(w, resp)
}

// MessageAgentHandler handles POST /api/agent/message
func MessageAgentHandler(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}
	var req models.AgentMessageRequest
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if err := req.Validate(); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	// Append user message to workflow checkpoint
	if req.From == "user" && req.Message != "" {
		t := time.Now().Format(time.RFC3339)
		if err := Services.WorkflowService.AddUserFeedback(req.ThreadID, req.From, req.Message, t); err != nil {
			logger.Infof("[ERROR MessageAgentHandler] Failed to add user feedback: %v", err)
		} else {
			logger.Infof("[MessageAgentHandler] Saved user message to FeedbackHistory: %q", req.Message)
		}
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	// Run feedback
	logger.Infof("[DEBUG MessageAgentHandler] Running agent CLI: plan feedback %s %s --from %s", req.ThreadID, req.Message, req.From)
	if _, err := runAgentCLI(ctx, "plan", "feedback", req.ThreadID, req.Message, "--from", req.From); err != nil {
		logger.Infof("[ERROR MessageAgentHandler] agent CLI feedback error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	// Run resume
	resumeArgs := []string{"resume", req.ThreadID}
	if req.Interactive {
		resumeArgs = append(resumeArgs, "--interactive")
	}
	logger.Infof("[DEBUG MessageAgentHandler] Running agent CLI resume: %v", resumeArgs)
	resp, err := runAgentCLI(ctx, resumeArgs...)
	if err != nil {
		logger.Infof("[ERROR MessageAgentHandler] agent CLI resume error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	logger.Infof("[DEBUG MessageAgentHandler] agent CLI resume response: %+v", resp)

	// Append agent response message to workflow checkpoint
	if resp.Message != "" {
		t := time.Now().Format(time.RFC3339)
		if err := Services.WorkflowService.AddAgentMessage(req.ThreadID, resp.Message, t); err != nil {
			logger.Infof("[ERROR MessageAgentHandler] Failed to add agent message: %v", err)
		} else {
			logger.Infof("[MessageAgentHandler] Saved agent message to AgentMessages: %q", resp.Message)
		}
	}

	writeJSON(w, resp)
}

// GetWorkflowStatus handles GET /api/agent/status/{threadId}
func GetWorkflowStatus(w http.ResponseWriter, r *http.Request) {
	threadID := chi.URLParam(r, "threadId")
	if threadID == "" {
		http.Error(w, "missing thread id", http.StatusBadRequest)
		return
	}
	state, err := Services.WorkflowService.GetWorkflowState(threadID)
	if err != nil {
		http.Error(w, "failed to get workflow state: "+err.Error(), http.StatusInternalServerError)
		logger.Errorw("Failed to get workflow state", "threadID", threadID, "error", err)
		return
	}
	writeJSON(w, state)
}

// ListWorkflows handles GET /api/agent/workflows
func ListWorkflows(w http.ResponseWriter, r *http.Request) {
	// Return empty list for now to allow agent initialization
	// TODO: Implement proper workflow listing from database
	writeJSON(w, map[string]interface{}{
		"workflows": []interface{}{},
	})
}

// CancelWorkflow handles DELETE /api/agent/workflows/{threadId}
func CancelWorkflow(w http.ResponseWriter, r *http.Request) {
	threadID := chi.URLParam(r, "threadId")
	if threadID == "" {
		http.Error(w, "missing thread id", http.StatusBadRequest)
		return
	}
	// Mark workflow as ABANDONED in the DB
	if err := Services.WorkflowService.UpdateWorkflowCheckpointWithMessage(threadID, "system", "ABANDONED"); err != nil {
		http.Error(w, "Failed to abandon workflow: "+err.Error(), http.StatusInternalServerError)
		logger.Errorw("Failed to abandon workflow", "threadID", threadID, "error", err)
		return
	}
	writeJSON(w, map[string]string{"status": "ABANDONED"})
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")

	var (
		b   []byte
		err error
	)

	if msg, ok := v.(proto.Message); ok {
		b, err = protojson.MarshalOptions{UseProtoNames: true}.Marshal(msg)
	} else {
		b, err = json.Marshal(v)
	}
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to marshal JSON response: %v", err), http.StatusInternalServerError)
		return
	}
	w.Write(b)
}
