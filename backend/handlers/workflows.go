package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

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

	// Retrieve messages for the workflow
	messages, err := models.GetMessages(DB, threadID)
	if err != nil {
		http.Error(w, "failed to get messages: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Load full workflow checkpoint data for messages
	messagesData, currentStep, err := models.GetWorkflowCheckpoint(DB, threadID)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "No workflow found for threadId", http.StatusNotFound)
		} else {
			http.Error(w, "Failed to fetch workflow checkpoint: "+err.Error(), http.StatusInternalServerError)
		}
		return
	}
	// Retrieve the full checkpoint_data for meal_plan (skip 'latest' namespace messages-only)
	var fullData []byte
	row := DB.QueryRow(`SELECT checkpoint_data FROM workflow_checkpoints WHERE thread_id=$1 AND checkpoint_ns!=$2 ORDER BY updated_at DESC LIMIT 1`, threadID, "latest")
	if scanErr := row.Scan(&fullData); scanErr != nil {
		fullData = messagesData
	}
	// Parse JSON to extract meal_plan
	var mealPlanRaw json.RawMessage
	var fullMap map[string]interface{}
	if err := json.Unmarshal(fullData, &fullMap); err == nil {
		// Try nested channel_values.meal_plan
		if cv, ok := fullMap["channel_values"].(map[string]interface{}); ok {
			if mp, ok := cv["meal_plan"]; ok {
				mpBytes, _ := json.Marshal(mp)
				mealPlanRaw = json.RawMessage(mpBytes)
			}
		}
		// Fallback to top-level meal_plan
		if mealPlanRaw == nil {
			if mp, ok := fullMap["meal_plan"]; ok {
				mpBytes, _ := json.Marshal(mp)
				mealPlanRaw = json.RawMessage(mpBytes)
			} else {
				mealPlanRaw = json.RawMessage("null")
			}
		}
	} else {
		mealPlanRaw = json.RawMessage("null")
	}

	// Build shopping list JSON
	var shoppingListRaw json.RawMessage
	var plan struct {
		Days []struct {
			Meal *struct { ID int `json:"id"` } `json:"meal"`
		} `json:"days"`
	}
	if err2 := json.Unmarshal(mealPlanRaw, &plan); err2 == nil {
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

	state := models.WorkflowState{
		ThreadID:     threadID,
		CurrentStep:  currentStep,
		Messages:     messages,
		MealPlan:     mealPlanRaw,
		ShoppingList: shoppingListRaw,
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
