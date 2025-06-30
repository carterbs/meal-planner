package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os/exec"
	"time"

	"mealplanner/models"

	"github.com/go-chi/chi/v5"
)

var agentCommandContext = exec.CommandContext

// runAgentCLI executes the agent CLI with given args and unmarshals JSON output into resp
func runAgentCLI(ctx context.Context, args ...string) (models.AgentResponse, error) {
	// Always add --json flag for API integration
	allArgs := append([]string{"../agent/dist/cli.js", "--json"}, args...)
	// Record the start time for profiling
	startTime := time.Now()
	log.Printf("[DEBUG runAgentCLI] Executing command: node %v", allArgs)

	cmd := agentCommandContext(ctx, "node", allArgs...)
	var stdoutBuffer, stderrBuffer bytes.Buffer
	cmd.Stdout = &stdoutBuffer
	cmd.Stderr = &stderrBuffer

	err := cmd.Run()
	duration := time.Since(startTime)
	log.Printf("[DEBUG runAgentCLI] Command completed in %s", duration)

	if err != nil {
		// Combine stderr and stdout in the error message for comprehensive debugging info
		errMsg := "agent CLI execution failed: " + err.Error()
		if stderrBuffer.Len() > 0 {
			errMsg += "\nStderr: " + stderrBuffer.String()
		}
		if stdoutBuffer.Len() > 0 {
			errMsg += "\nStdout: " + stdoutBuffer.String()
		}
		log.Printf("[ERROR runAgentCLI] %s", errMsg)
		return models.AgentResponse{}, errors.New(errMsg)
	}

	// Log the buffers before attempting to unmarshal stdout
	log.Printf("[DEBUG runAgentCLI] Stderr from agent: %s", stderrBuffer.String())
	log.Printf("[DEBUG runAgentCLI] Stdout from agent: %s", stdoutBuffer.String())

	// Attempt to unmarshal stdout only
	var resp models.AgentResponse
	if err := json.Unmarshal(stdoutBuffer.Bytes(), &resp); err != nil {
		// If unmarshal fails, return an error including the stdout that failed to parse
		return models.AgentResponse{}, errors.New("failed to unmarshal agent response: " + err.Error() + "\nStdout: " + stdoutBuffer.String()) // Include stdoutBuffer for context
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

	// Create session in database
	if resp.ThreadID != "" {
		session, err := models.CreateAgentSession(DB, resp.ThreadID, req.WorkflowType)
		if err != nil {
			log.Printf("[ERROR StartAgentWorkflow] Failed to create session in database: %v", err)
			// Don't fail the request, just log the error
		} else {
			// Store initial meal plan and shopping list if present
			if resp.Raw != nil {
				if rawMap, ok := resp.Raw.(map[string]interface{}); ok {
					if mealPlan, ok := rawMap["meal_plan"]; ok {
						if mealPlanBytes, err := json.Marshal(mealPlan); err == nil {
							session.MealPlan = mealPlanBytes
						}
					}
					if shoppingList, ok := rawMap["shopping_list_formatted"].(string); ok {
						session.ShoppingList = shoppingList
					}
				}
				models.UpdateAgentSession(DB, session)
			}

			// Add initial agent message if present
			if resp.Message != "" {
				models.AddMessage(DB, resp.ThreadID, "agent", resp.Message)
			}
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

	// Store user message in database
	if req.From == "user" && req.Message != "" {
		_, err := models.AddMessage(DB, req.ThreadID, "user", req.Message)
		if err != nil {
			log.Printf("[ERROR AddAgentFeedback] Failed to store user message: %v", err)
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	log.Printf("[DEBUG AddAgentFeedback] Running agent CLI: plan feedback %s %s --from %s", req.ThreadID, req.Message, req.From)
	resp, err := runAgentCLI(ctx, "plan", "feedback", req.ThreadID, req.Message, "--from", req.From)
	if err != nil {
		log.Printf("[ERROR AddAgentFeedback] agent CLI error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	log.Printf("[DEBUG AddAgentFeedback] agent CLI response: %+v", resp)

	// Store agent response message in database and update workflow checkpoint
	if resp.Message != "" {
		// Store in messages table
		if _, err := models.AddMessage(DB, req.ThreadID, "agent", resp.Message); err != nil {
			log.Printf("[ERROR AddAgentFeedback] Failed to store agent message: %v", err)
		}

		// Update workflow checkpoint with full message history
		if err := models.UpdateWorkflowCheckpointWithMessage(DB, req.ThreadID, "agent", resp.Message); err != nil {
			log.Printf("[ERROR AddAgentFeedback] Failed to update workflow checkpoint: %v", err)
		}
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

	// Update session state with new data from response
	if resp.ThreadID != "" {
		session, err := models.GetAgentSession(DB, resp.ThreadID)
		if err == nil {
			// Update meal plan and shopping list if present
			if resp.Raw != nil {
				if rawMap, ok := resp.Raw.(map[string]interface{}); ok {
					if mealPlan, ok := rawMap["meal_plan"]; ok {
						if mealPlanBytes, err := json.Marshal(mealPlan); err == nil {
							session.MealPlan = mealPlanBytes
						}
					}
					if shoppingList, ok := rawMap["shopping_list_formatted"].(string); ok {
						session.ShoppingList = shoppingList
					}
				}
			}


			models.UpdateAgentSession(DB, session)

			// Add agent message if present
			if resp.Message != "" {
				models.AddMessage(DB, resp.ThreadID, "agent", resp.Message)
			}
		}
	}

	writeJSON(w, resp)
}

// MessageAgentHandler handles POST /api/agent/message
func MessageAgentHandler(w http.ResponseWriter, r *http.Request) {
	if UseDummy {
		http.Error(w, "Not implemented in dummy mode", http.StatusNotImplemented)
		return
	}
	var req models.AgentMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if err := req.Validate(); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	// Store user message in database and workflow checkpoint
	if req.From == "user" && req.Message != "" {
		// Store in messages table
		if _, err := models.AddMessage(DB, req.ThreadID, "user", req.Message); err != nil {
			log.Printf("[ERROR MessageAgentHandler] Failed to store user message: %v", err)
		}

		// Update workflow checkpoint with full message history
		if err := models.UpdateWorkflowCheckpointWithMessage(DB, req.ThreadID, "user", req.Message); err != nil {
			log.Printf("[ERROR MessageAgentHandler] Failed to update workflow checkpoint: %v", err)
		}
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	// Run feedback
	log.Printf("[DEBUG MessageAgentHandler] Running agent CLI: plan feedback %s %s --from %s", req.ThreadID, req.Message, req.From)
	if _, err := runAgentCLI(ctx, "plan", "feedback", req.ThreadID, req.Message, "--from", req.From); err != nil {
		log.Printf("[ERROR MessageAgentHandler] agent CLI feedback error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	// Run resume
	resumeArgs := []string{"resume", req.ThreadID}
	if req.Interactive {
		resumeArgs = append(resumeArgs, "--interactive")
	}
	log.Printf("[DEBUG MessageAgentHandler] Running agent CLI resume: %v", resumeArgs)
	resp, err := runAgentCLI(ctx, resumeArgs...)
	if err != nil {
		log.Printf("[ERROR MessageAgentHandler] agent CLI resume error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	log.Printf("[DEBUG MessageAgentHandler] agent CLI resume response: %+v", resp)

	// Store agent response message in database if present
	if resp.Message != "" {
		if _, err := models.AddMessage(DB, req.ThreadID, "agent", resp.Message); err != nil {
			log.Printf("[ERROR MessageAgentHandler] Failed to store agent message: %v", err)
		}

		// Update workflow checkpoint with full message history
		if err := models.UpdateWorkflowCheckpointWithMessage(DB, req.ThreadID, "agent", resp.Message); err != nil {
			log.Printf("[ERROR MessageAgentHandler] Failed to update workflow checkpoint: %v", err)
		}
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
