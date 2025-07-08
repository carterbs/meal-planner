package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
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
	var cp map[string]any
	var md map[string]any
	json.Unmarshal(data, &cp)
	json.Unmarshal(meta, &md)
	resp := map[string]any{
		"found": true,
		"tuple": map[string]any{
			"checkpoint": cp,
			"metadata":   md,
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
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	if req.ThreadID == "" || req.CheckpointNS == "" {
		http.Error(w, "thread_id and checkpoint_ns required", http.StatusBadRequest)
		return
	}
	if err := Services.CheckpointService.PutCheckpoint(req.ThreadID, req.CheckpointNS, req.WorkflowType, req.Checkpoint, req.Metadata); err != nil {
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
