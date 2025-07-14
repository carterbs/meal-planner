package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	apipb "mealplanner/generated/go"

	"github.com/go-chi/chi/v5"
	"google.golang.org/protobuf/encoding/protojson"
)

// GetCheckpoint handles GET /api/checkpoints/{thread_id}
func GetCheckpoint(w http.ResponseWriter, r *http.Request) {
	threadID := chi.URLParam(r, "thread_id")
	if threadID == "" {
		http.Error(w, "missing thread id", http.StatusBadRequest)
		return
	}
	ns := r.URL.Query().Get("checkpoint_ns")
	data, meta, found, err := Services.CheckpointService.GetCheckpoint(threadID, ns)
	if err != nil {
		http.Error(w, "failed to get checkpoint: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if !found {
		writeJSON(w, map[string]any{"found": false})
		return
	}
	// Convert stored JSON into protobuf messages to ensure canonical JSON output
	var cpMsg apipb.AgentCheckpoint
	var mdMsg apipb.AgentCheckpointMetadata

	// First try strict unmarshaling to ensure the stored checkpoint matches the
	// current protobuf schema. If it fails due to unknown legacy fields, fall back
	// to a lenient unmarshaler that discards the unknown fields so that we remain
	// backward-compatible with older checkpoints that may still contain fields
	// such as \"workflow_type\" or the deprecated \"channel_values\" wrapper.
	strictOpts := protojson.UnmarshalOptions{
		AllowPartial:   false,
		DiscardUnknown: false,
	}
	if err := strictOpts.Unmarshal(data, &cpMsg); err != nil {
		logger.Warn("[GetCheckpoint] strict unmarshal failed; attempting lenient unmarshal: " + err.Error())
		lenientOpts := protojson.UnmarshalOptions{
			AllowPartial:   true,
			DiscardUnknown: true,
		}
		if err := lenientOpts.Unmarshal(data, &cpMsg); err != nil {
			logger.Error("[GetCheckpoint] corrupt checkpoint even after lenient unmarshal: " + err.Error())
			http.Error(w, "invalid stored checkpoint: "+err.Error(), http.StatusInternalServerError)
			return
		}
	}
	_ = strictOpts.Unmarshal(meta, &mdMsg) // metadata may be empty; ignore errors

	cpJSON, _ := protojson.Marshal(&cpMsg)
	mdJSON, _ := protojson.Marshal(&mdMsg)
	logger.Debug("[DEBUG] Marshaled checkpoint JSON: " + string(cpJSON))
	logger.Debug("[DEBUG] Marshaled metadata JSON: " + string(mdJSON))

	resp := map[string]any{
		"found": true,
		"tuple": map[string]any{
			"checkpoint": json.RawMessage(cpJSON),
			"metadata":   json.RawMessage(mdJSON),
		},
	}
	writeJSON(w, resp)
}

// PutCheckpoint handles POST /api/checkpoints
func PutCheckpoint(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}
	var req struct {
		ThreadID     string          `json:"thread_id"`
		CheckpointNS string          `json:"checkpoint_ns"`
		WorkflowType string          `json:"workflow_type"`
		Checkpoint   json.RawMessage `json:"checkpoint"`
		Metadata     json.RawMessage `json:"metadata"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		logger.Error("[PutCheckpoint] invalid JSON: " + err.Error())
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	logger.Info("[PutCheckpoint] received checkpoint", "threadID", req.ThreadID, "checkpointNS", req.CheckpointNS, "incomingWorkflowType", req.WorkflowType)
	if req.ThreadID == "" || req.CheckpointNS == "" {
		logger.Error("[PutCheckpoint] thread_id and checkpoint_ns required")
		http.Error(w, "thread_id and checkpoint_ns required", http.StatusBadRequest)
		return
	}
	// Ensure checkpoint & metadata conform to protobuf schema before saving
	var cpMsg apipb.AgentCheckpoint
	var mdMsg apipb.AgentCheckpointMetadata
	// Strict unmarshaling – reject unknown or duplicate fields so that we never
	// persist malformed checkpoint JSON. This will cause the request to fail
	// fast if the payload contains legacy snake_case fields (e.g. "channel_values")
	// or any other unknown attributes.
	unmarshalOpts := protojson.UnmarshalOptions{
		AllowPartial:   false,
		DiscardUnknown: false,
	}
	if err := unmarshalOpts.Unmarshal(req.Checkpoint, &cpMsg); err != nil {
		logger.Error("[PutCheckpoint] invalid checkpoint: " + err.Error())
		http.Error(w, "invalid checkpoint: "+err.Error(), http.StatusBadRequest)
		return
	}
	if err := unmarshalOpts.Unmarshal(req.Metadata, &mdMsg); err != nil {
		// Allow metadata to be empty / partial
		mdMsg = apipb.AgentCheckpointMetadata{}
	}
	// Determine workflow type, fallback to meal_planning
	workflowType := req.WorkflowType
	if workflowType == "" {
		workflowType = "meal_planning"
	}

	cpJSON, _ := protojson.Marshal(&cpMsg)
	mdJSON, _ := protojson.Marshal(&mdMsg)

	// this is asbsolute horseshit that needs to be removed, but until we have better proto coverage, it exists. this was previoulsy being saved as undefined.
	var gen map[string]any
	if err := json.Unmarshal(cpJSON, &gen); err == nil {
		if st, ok := gen["state"].(map[string]any); ok {
			if _, exists := st["workflow_type"]; !exists {
				st["workflow_type"] = workflowType
				gen["state"] = st
				if patched, err := json.Marshal(gen); err == nil {
					cpJSON = patched
					logger.Debug("[PutCheckpoint] injected workflow_type into checkpoint state", "threadID", req.ThreadID, "workflowType", workflowType)
				}
			}
		}
	}

	logger.Debug("[DEBUG] Marshaled checkpoint JSON: " + string(cpJSON))
	logger.Debug("[DEBUG] Marshaled metadata JSON: " + string(mdJSON))

	if err := Services.CheckpointService.PutCheckpoint(req.ThreadID, req.CheckpointNS, workflowType, cpJSON, mdJSON); err != nil {
		logger.Error("[PutCheckpoint] failed to save checkpoint: " + err.Error())
		http.Error(w, "failed to save checkpoint: "+err.Error(), http.StatusInternalServerError)
		return
	}
	resp := map[string]any{
		"success":       true,
		"thread_id":     req.ThreadID,
		"checkpoint_ns": req.CheckpointNS,
	}
	writeJSON(w, resp)
}

// ListCheckpoints handles GET /api/checkpoints
func ListCheckpoints(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	before := r.URL.Query().Get("before")
	limit := 100
	if limitStr != "" {
		if v, err := strconv.Atoi(limitStr); err == nil {
			limit = v
		}
	}
	recs, err := Services.CheckpointService.ListCheckpoints(limit, before)
	if err != nil {
		http.Error(w, "failed to list checkpoints: "+err.Error(), http.StatusInternalServerError)
		return
	}
	entries := []map[string]any{}
	for _, r := range recs {
		var cp map[string]any
		var md map[string]any
		json.Unmarshal(r.Checkpoint, &cp)
		json.Unmarshal(r.Metadata, &md)
		entries = append(entries, map[string]any{
			"thread_id":     r.ThreadID,
			"checkpoint_ns": r.CheckpointNS,
			"tuple": map[string]any{
				"checkpoint": cp,
				"metadata":   md,
			},
		})
	}
	writeJSON(w, map[string]any{"entries": entries})
}
