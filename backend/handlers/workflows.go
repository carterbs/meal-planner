package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"sort"

	"mealplanner/models"

	"github.com/go-chi/chi/v5"
)

// in-memory map to track workflow status like ABANDONED (kept for backwards compatibility)
var workflowStatus = make(map[string]string)

// parseJSON parses JSON from request body into target struct
func parseJSON(r *http.Request, target interface{}) error {
	return json.NewDecoder(r.Body).Decode(target)
}

// GetWorkflowState handles GET /api/workflows/{threadId}
func GetWorkflowState(w http.ResponseWriter, r *http.Request) {
	threadID := chi.URLParam(r, "threadId")
	if threadID == "" {
		http.Error(w, "missing thread id", http.StatusBadRequest)
		return
	}

	state, err := Services.WorkflowService.GetWorkflowState(threadID)
	if err != nil {
		http.Error(w, "failed to get workflow state: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Smash FeedbackHistory and AgentMessages together, sort by timestamp, return as messages
	type chatMsg struct {
		Sender string
		Text   string
		Time   string
	}
	var combined []chatMsg
	for _, fb := range state.FeedbackHistory {
		combined = append(combined, chatMsg{
			Sender: fb.From,
			Text:   fb.Message,
			Time:   fb.Timestamp,
		})
	}
	for _, am := range state.AgentMessages {
		combined = append(combined, chatMsg{
			Sender: am.Sender,
			Text:   am.Text,
			Time:   am.Timestamp,
		})
	}
	sort.SliceStable(combined, func(i, j int) bool {
		if combined[i].Time == "" && combined[j].Time == "" {
			return false
		}
		if combined[i].Time == "" {
			return false
		}
		if combined[j].Time == "" {
			return true
		}
		return combined[i].Time < combined[j].Time
	})

	messages := make([]models.ChatMessage, len(combined))
	for i, v := range combined {
		messages[i] = models.ChatMessage{Sender: v.Sender, Text: v.Text}
	}

	// Return as before, but with combined chat history
	mealPlanRaw, shoppingListRaw, currentStep := json.RawMessage([]byte("null")), json.RawMessage([]byte("null")), ""
	if state.MealPlan != nil {
		if b, err := json.Marshal(state.MealPlan); err == nil {
			mealPlanRaw = json.RawMessage(b)
		}
	}
	if state.ShoppingList != nil {
		if b, err := json.Marshal(state.ShoppingList); err == nil {
			shoppingListRaw = json.RawMessage(b)
		}
	}
	currentStep = state.CurrentStep

	resp := models.WorkflowState{
		ThreadID:     threadID,
		CurrentStep:  currentStep,
		Messages:     messages,
		MealPlan:     mealPlanRaw,
		ShoppingList: shoppingListRaw,
	}
	writeJSON(w, resp)
}

// AbandonWorkflow handles POST /api/workflows/{threadId}/abandon
func AbandonWorkflow(w http.ResponseWriter, r *http.Request) {
	threadID := chi.URLParam(r, "threadId")
	if threadID == "" {
		http.Error(w, "missing thread id", http.StatusBadRequest)
		return
	}

	// Append abandonment event to workflow checkpoint
	if err := models.UpdateWorkflowCheckpointWithMessage(DB, threadID, "system", "ABANDONED"); err != nil {
		http.Error(w, "Failed to abandon workflow: "+err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]string{"status": "ABANDONED"})
}

// AddMessage handles POST /api/workflows/{threadId}/messages
func AddMessage(w http.ResponseWriter, r *http.Request) {
	threadID := chi.URLParam(r, "threadId")
	if threadID == "" {
		http.Error(w, "missing thread id", http.StatusBadRequest)
		return
	}

	var req struct {
		Sender  string `json:"sender"`
		Message string `json:"message"`
	}

	if err := parseJSON(r, &req); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.Sender != "user" && req.Sender != "agent" {
		http.Error(w, "sender must be 'user' or 'agent'", http.StatusBadRequest)
		return
	}

	if req.Message == "" {
		http.Error(w, "message cannot be empty", http.StatusBadRequest)
		return
	}

	message, err := models.AddMessage(DB, threadID, req.Sender, req.Message)
	if err != nil {
		http.Error(w, "failed to add message: "+err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, message)
}

// UpdateSessionState handles PUT /api/workflows/{threadId}/state
func UpdateSessionState(w http.ResponseWriter, r *http.Request) {
	threadID := chi.URLParam(r, "threadId")
	if threadID == "" {
		http.Error(w, "missing thread id", http.StatusBadRequest)
		return
	}

	var req struct {
		MealPlan     *json.RawMessage `json:"meal_plan,omitempty"`
		ShoppingList *json.RawMessage `json:"shopping_list,omitempty"`
		CurrentStep  *string          `json:"current_step,omitempty"`
		Status       *string          `json:"status,omitempty"`
	}

	if err := parseJSON(r, &req); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Load existing checkpoint
	data, _, err := models.GetWorkflowCheckpoint(DB, threadID)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "No workflow found for threadId", http.StatusNotFound)
		} else {
			http.Error(w, "Failed to fetch workflow checkpoint: "+err.Error(), http.StatusInternalServerError)
		}
		return
	}

	// Merge updates
	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		http.Error(w, "failed to parse checkpoint: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if req.MealPlan != nil {
		m["meal_plan"] = *req.MealPlan
	}
	if req.ShoppingList != nil {
		m["shopping_list"] = *req.ShoppingList
	}
	if req.CurrentStep != nil {
		m["current_step"] = *req.CurrentStep
	}
	if req.Status != nil {
		m["status"] = *req.Status
	}

	newData, err := json.Marshal(m)
	if err != nil {
		http.Error(w, "failed to serialize checkpoint: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if err := models.UpdateWorkflowCheckpoint(DB, threadID, newData); err != nil {
		http.Error(w, "failed to update workflow checkpoint: "+err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]string{"status": "updated"})
}
