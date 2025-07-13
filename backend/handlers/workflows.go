package handlers

import (
	"database/sql"
	"encoding/json"
	"io"
	"net/http"

	"google.golang.org/protobuf/encoding/protojson"

	apipb "mealplanner/generated/go"
	"mealplanner/models"

	"github.com/go-chi/chi/v5"
)

// GetWorkflowState handles GET /api/workflows/{threadId}
func GetWorkflowState(w http.ResponseWriter, r *http.Request) {
	threadID := chi.URLParam(r, "threadId")
	if threadID == "" {
		http.Error(w, "missing thread id", http.StatusBadRequest)
		return
	}

	// Get latest meal plan identifier
	plan, err := Services.MealPlanService.GetLatestMealPlan(threadID)
	if err != nil {
		if err == sql.ErrNoRows {
			writeJSON(w, map[string]any{
				"plan":          nil,
				"entries":       []models.MealPlanEntry{},
				"messages":      []models.ChatMessage{},
				"shopping_list": []*apipb.ShoppingListItem{},
			})
			return
		}
		http.Error(w, "failed to get latest meal plan: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Get meal plan entries
	entries, err := Services.MealPlanService.GetMealPlanItems(plan.ID)
	if err != nil {
		http.Error(w, "failed to get meal plan items: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// get meals from meal plan entries
	mealIDs := make([]int, 0)
	// soon we will be able to get Ids from the meal plan entries

	// generate shopping list from meals
	shoppingList, err := buildShoppingList(mealIDs)
	if err != nil {
		http.Error(w, "failed to generate shopping list: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Get messages for the thread
	messages, err := Services.MessageService.GetMessages(threadID)
	if err != nil {
		http.Error(w, "failed to get messages: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Fetch additional details from checkpoint to include workflow metadata
	var workflowType, currentStep string
	if st, err := Services.WorkflowService.GetWorkflowState(threadID); err == nil {
		workflowType = st.WorkflowType
		currentStep = st.CurrentStep
	}
	if workflowType == "" {
		workflowType = "meal_planning"
	}

	// Build and return response
	type WorkflowStateResponse struct {
		Plan          *models.MealPlanIdentifier `json:"plan"`
		Entries       []models.MealPlanEntry     `json:"entries"`
		Messages      []models.ChatMessage       `json:"messages"`
		ShoppingList  []*apipb.ShoppingListItem  `json:"shopping_list"`
		WorkflowType  string                     `json:"workflowType,omitempty"`
		Workflow_Type string                     `json:"workflow_type,omitempty"`
		CurrentStep   string                     `json:"currentStep,omitempty"`
	}
	resp := WorkflowStateResponse{
		Plan:          plan,
		Entries:       entries,
		Messages:      messages,
		ShoppingList:  shoppingList,
		WorkflowType:  workflowType,
		Workflow_Type: workflowType,
		CurrentStep:   currentStep,
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
	if err := Services.WorkflowService.UpdateWorkflowCheckpointWithMessage(threadID, "system", "ABANDONED"); err != nil {
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

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}
	var req apipb.AddMessageRequest
	if err := protojson.Unmarshal(body, &req); err != nil {
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

	message, err := Services.WorkflowService.AddMessage(threadID, req.Sender, req.Message)
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

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}
	var req apipb.UpdateSessionStateRequest
	if err := protojson.Unmarshal(body, &req); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Load existing checkpoint
	data, _, err := Services.WorkflowService.GetWorkflowCheckpoint(threadID)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "No workflow found for threadId", http.StatusNotFound)
		} else {
			http.Error(w, "Failed to fetch workflow checkpoint: "+err.Error(), http.StatusInternalServerError)
		}
		return
	}

	// AGENT-REFACTOR: The handler is doing too much here. Move this to a service layer function.
	// Merge updates
	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		http.Error(w, "failed to parse checkpoint: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if req.MealPlan != "" {
		var mp json.RawMessage = json.RawMessage(req.MealPlan)
		m["meal_plan"] = mp
	}
	if req.ShoppingList != "" {
		var sl json.RawMessage = json.RawMessage(req.ShoppingList)
		m["shopping_list"] = sl
	}
	if req.CurrentStep != "" {
		m["current_step"] = req.CurrentStep
	}
	if req.Status != "" {
		m["status"] = req.Status
	}

	newData, err := json.Marshal(m)
	if err != nil {
		http.Error(w, "failed to serialize checkpoint: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if err := Services.WorkflowService.UpdateWorkflowCheckpoint(threadID, newData); err != nil {
		http.Error(w, "failed to update workflow checkpoint: "+err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]string{"status": "updated"})
}
