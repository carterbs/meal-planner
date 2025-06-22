package handlers

import (
	"net/http"

	"mealplanner/models"

	"github.com/go-chi/chi/v5"
)

// in-memory store for demo purposes
var workflowStore = map[string]*models.WorkflowState{}

// GetWorkflow handles GET /api/workflows/{threadId}
func GetWorkflow(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "threadId")
	wf, ok := workflowStore[id]
	if !ok {
		http.NotFound(w, r)
		return
	}
	writeJSON(w, wf)
}

// AbandonWorkflow handles POST /api/workflows/{threadId}/abandon
func AbandonWorkflow(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "threadId")
	if wf, ok := workflowStore[id]; ok {
		wf.Status = models.WorkflowStatusAbandoned
	}
	writeJSON(w, map[string]string{"status": models.WorkflowStatusAbandoned})
}
