package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

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
// Returns complete session data from database
func GetWorkflowState(w http.ResponseWriter, r *http.Request) {
	threadID := chi.URLParam(r, "threadId")
	if threadID == "" {
		http.Error(w, "missing thread id", http.StatusBadRequest)
		return
	}

	// Try to get session from database first
	session, err := models.GetAgentSession(DB, threadID)
	if err != nil {
		if err == sql.ErrNoRows {
			// Session not found in database, check in-memory status for backwards compatibility
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
			return
		}
		http.Error(w, "failed to get session: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Get messages for the session
	messages, err := models.GetMessages(DB, threadID)
	if err != nil {
		http.Error(w, "failed to get messages: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Try to get workflow data from checkpoints table (where the real data is)
	mealPlan, currentStep, err := models.GetWorkflowCheckpoint(DB, threadID)
	if err != nil {
		// Fallback to session data if checkpoint not found
		mealPlan = session.MealPlan
		currentStep = session.CurrentStep
	}

	// Build complete workflow state
	// Prepare shopping list JSON
	var shoppingListRaw json.RawMessage
	if session.ShoppingList != "" {
		shoppingListRaw = json.RawMessage(session.ShoppingList)
	} else {
		// Derive from mealPlan
		var plan struct {
			Days []struct { Meal *struct { ID int `json:"id"` } `json:"meal"` } `json:"days"`
		}
		if err2 := json.Unmarshal(mealPlan, &plan); err2 == nil {
			ids := []int{}
			for _, d := range plan.Days {
				if d.Meal != nil {
					ids = append(ids, d.Meal.ID)
				}
			}
			if items, err2 := buildShoppingList(ids); err2 == nil {
				if b, err3 := json.Marshal(items); err3 == nil {
					shoppingListRaw = json.RawMessage(b)
				}
			}
		}
		if shoppingListRaw == nil {
			shoppingListRaw = json.RawMessage("[]")
		}
	}

	state := models.WorkflowState{
		ThreadID:     session.ThreadID,
		WorkflowType: session.WorkflowType,
		CurrentStep:  currentStep,
		Status:       session.Status,
		Messages:     messages,
		MealPlan:     mealPlan,
		ShoppingList: shoppingListRaw,
		CreatedAt:    session.CreatedAt,
		UpdatedAt:    session.UpdatedAt,
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

	// Update database session status to ABANDONED
	session, err := models.GetAgentSession(DB, threadID)
	if err != nil && err != sql.ErrNoRows {
		http.Error(w, "failed to get session: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if err == sql.ErrNoRows {
		// Session not in database, use in-memory status for backwards compatibility
		workflowStatus[threadID] = "ABANDONED"
	} else {
		// Update database
		session.Status = "ABANDONED"
		err = models.UpdateAgentSession(DB, session)
		if err != nil {
			http.Error(w, "failed to update session: "+err.Error(), http.StatusInternalServerError)
			return
		}
	}

	if !UseDummy {
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()
		// Attempt to cancel workflow via agent CLI; ignore error
		runAgentCLI(ctx, "cancel", threadID, "--force")
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
		ShoppingList *string          `json:"shopping_list,omitempty"`
		CurrentStep  *string          `json:"current_step,omitempty"`
		Status       *string          `json:"status,omitempty"`
	}

	if err := parseJSON(r, &req); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	session, err := models.GetAgentSession(DB, threadID)
	if err != nil {
		http.Error(w, "failed to get session: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Update fields that were provided
	if req.MealPlan != nil {
		session.MealPlan = *req.MealPlan
	}
	if req.ShoppingList != nil {
		session.ShoppingList = *req.ShoppingList
	}
	if req.CurrentStep != nil {
		session.CurrentStep = *req.CurrentStep
	}
	if req.Status != nil {
		session.Status = *req.Status
	}

	err = models.UpdateAgentSession(DB, session)
	if err != nil {
		http.Error(w, "failed to update session: "+err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]string{"status": "updated"})
}
