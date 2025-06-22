package handlers

import (
	"context"
	"net/http"
	"time"

	"mealplanner/models"

	"github.com/go-chi/chi/v5"
)

// in-memory map to track workflow status like ABANDONED
var workflowStatus = make(map[string]string)

// GetWorkflowState handles GET /api/workflows/{threadId}
func GetWorkflowState(w http.ResponseWriter, r *http.Request) {
	threadID := chi.URLParam(r, "threadId")
	if threadID == "" {
		http.Error(w, "missing thread id", http.StatusBadRequest)
		return
	}

	state := models.WorkflowState{ThreadID: threadID, Status: "ACTIVE"}
	if s, ok := workflowStatus[threadID]; ok {
		state.Status = s
	}

	if !UseDummy {
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()
		resp, err := runAgentCLI(ctx, "status", threadID)
		if err == nil {
			state.CurrentStep = resp.CurrentStep
		}
	}

	writeJSON(w, state)
}

// AbandonWorkflow handles POST /api/workflows/{threadId}/abandon
func AbandonWorkflow(w http.ResponseWriter, r *http.Request) {
	threadID := chi.URLParam(r, "threadId")
	if threadID == "" {
		http.Error(w, "missing thread id", http.StatusBadRequest)
		return
	}

	if !UseDummy {
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()
		// Attempt to cancel workflow via agent CLI; ignore error
		runAgentCLI(ctx, "cancel", threadID, "--force")
	}

	workflowStatus[threadID] = "ABANDONED"
	writeJSON(w, map[string]string{"status": "ABANDONED"})
}
