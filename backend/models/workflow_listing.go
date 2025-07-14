package models

import (
    "database/sql"
    "encoding/json"
    "fmt"
)

// ListWorkflows returns the most recent checkpoint for up to `limit` workflows.
// It extracts workflow status summary (participants, current step, etc.) from the
// stored checkpoint JSON.
func ListWorkflows(db *sql.DB, limit int) ([]WorkflowStatus, error) {
    const query = `SELECT thread_id, workflow_type, checkpoint_data
        FROM workflow_checkpoints
        WHERE checkpoint_ns = 'latest'
        ORDER BY updated_at DESC`

    rows, err := db.Query(query)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    seen := make(map[string]struct{})
    var results []WorkflowStatus

    for rows.Next() {
        var threadID, wfType string
        var data []byte
        if err := rows.Scan(&threadID, &wfType, &data); err != nil {
            return nil, err
        }
        if _, ok := seen[threadID]; ok {
            continue // already took latest row for this thread
        }
        seen[threadID] = struct{}{}

        var raw map[string]interface{}
        if err := json.Unmarshal(data, &raw); err != nil {
            // skip malformed rows but continue processing others
            continue
        }
        var participants []string
        var currentStep string

        // Extract participants
        if st, ok := raw["state"].(map[string]interface{}); ok {
            if pArr, ok := st["participants"].([]interface{}); ok {
                for _, p := range pArr {
                    if ps, ok := p.(string); ok {
                        participants = append(participants, ps)
                    }
                }
            }
        }
        // Extract currentStep either from top-level "step" or state.currentStep
        if step, ok := raw["step"]; ok {
            currentStep = fmt.Sprint(step)
        } else if st, ok := raw["state"].(map[string]interface{}); ok {
            if cs, ok := st["currentStep"]; ok {
                currentStep = fmt.Sprint(cs)
            }
        }

        results = append(results, WorkflowStatus{
            ThreadID:     threadID,
            WorkflowType: wfType,
            CurrentStep:  currentStep,
            Participants: participants,
        })
        if limit > 0 && len(results) >= limit {
            break
        }
    }
    return results, nil
}
