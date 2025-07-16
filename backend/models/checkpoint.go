package models

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// ChatMessage represents a chat message in a workflow
type ChatMessage struct {
	Sender string `json:"sender"`
	Text   string `json:"text"`
}

// GetWorkflowCheckpoint retrieves the latest checkpoint data for a thread
func GetWorkflowCheckpoint(db *sql.DB, threadID string) ([]byte, string, error) {
	const query = `
		SELECT checkpoint_data, checkpoint_ns
		FROM workflow_checkpoints
		WHERE thread_id = $1
		ORDER BY updated_at DESC
		LIMIT 1`
	var data []byte
	var ns string
	err := db.QueryRow(query, threadID).Scan(&data, &ns)
	if err != nil {
		return nil, "", err
	}
	return data, ns, nil
}

// UpdateWorkflowCheckpoint upserts checkpoint_data for a thread under namespace "latest"
func UpdateWorkflowCheckpoint(db *sql.DB, threadID string, data []byte) error {
	// Extract workflow_type from the checkpoint JSON so that the `latest`
	// row always has a non-empty workflow_type. This prevents downstream
	// consumers (agent resume, listWorkflows, etc.) from seeing an empty
	// value when they load the most-recent checkpoint.
	var wfType string
	var generic map[string]any
	if err := json.Unmarshal(data, &generic); err == nil {
		// First try nested state.workflow_type (canonical)
		if st, ok := generic["state"].(map[string]any); ok {
			if wt, ok := st["workflow_type"].(string); ok && wt != "" {
				wfType = wt
			}
		}
		// Fallback to top-level workflow_type if present (legacy)
		if wfType == "" {
			if wt, ok := generic["workflow_type"].(string); ok && wt != "" {
				wfType = wt
			}
		}
	}
	if wfType == "" {
		wfType = "meal_planning"
	}

	const query = `
        INSERT INTO workflow_checkpoints (thread_id, workflow_type, checkpoint_ns, checkpoint_data, created_at, updated_at)
        VALUES ($1, $2, 'latest', $3, NOW(), NOW())
        ON CONFLICT (thread_id, checkpoint_ns)
        DO UPDATE SET workflow_type = EXCLUDED.workflow_type, checkpoint_data = EXCLUDED.checkpoint_data, updated_at = NOW()`
	_, err := db.Exec(query, threadID, wfType, data)
	return err
}

// AddMessage stores a message in the messages table
func AddMessage(db *sql.DB, threadID, sender, content string) error {
	const query = `
		INSERT INTO messages (thread_id, sender, content, created_at)
		VALUES ($1, $2, $3, NOW())`
	
	_, err := db.Exec(query, threadID, sender, content)
	if err != nil {
		return fmt.Errorf("failed to insert message: %w", err)
	}
	return nil
}

// GetMessages retrieves all messages for a thread
func GetMessages(db *sql.DB, threadID string) ([]ChatMessage, error) {
	const query = `
		SELECT sender, content FROM messages 
		WHERE thread_id = $1 
		ORDER BY created_at ASC`
	
	rows, err := db.Query(query, threadID)
	if err != nil {
		return nil, fmt.Errorf("failed to query messages: %w", err)
	}
	defer rows.Close()
	
	var messages []ChatMessage
	for rows.Next() {
		var msg ChatMessage
		if err := rows.Scan(&msg.Sender, &msg.Text); err != nil {
			return nil, fmt.Errorf("failed to scan message: %w", err)
		}
		messages = append(messages, msg)
	}
	
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating messages: %w", err)
	}
	
	return messages, nil
}

// GetMessagesForProtobuf retrieves all messages for a thread in protobuf format
func GetMessagesForProtobuf(db *sql.DB, threadID string) ([]map[string]interface{}, error) {
	const query = `
		SELECT sender, content, created_at FROM messages 
		WHERE thread_id = $1 
		ORDER BY created_at ASC`
	
	rows, err := db.Query(query, threadID)
	if err != nil {
		return nil, fmt.Errorf("failed to query messages: %w", err)
	}
	defer rows.Close()
	
	var messages []map[string]interface{}
	for rows.Next() {
		var sender, content string
		var createdAt time.Time
		
		if err := rows.Scan(&sender, &content, &createdAt); err != nil {
			return nil, fmt.Errorf("failed to scan message: %w", err)
		}
		
		messages = append(messages, map[string]interface{}{
			"thread_id":  threadID,
			"sender":     sender,
			"content":    content,
			"created_at": createdAt.Format(time.RFC3339),
		})
	}
	
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating messages: %w", err)
	}
	
	return messages, nil
}

// UpdateWorkflowCheckpointWithMessage is deprecated - use AddMessage instead
func UpdateWorkflowCheckpointWithMessage(db *sql.DB, threadID, sender, message string) error {
	// Just add to messages table now
	return AddMessage(db, threadID, sender, message)
}

// AddMessageLegacy appends a message and returns it (for backward compatibility)
func AddMessageLegacy(db *sql.DB, threadID, sender, message string) (ChatMessage, error) {
	err := AddMessage(db, threadID, sender, message)
	if err != nil {
		return ChatMessage{}, err
	}
	return ChatMessage{Sender: sender, Text: message}, nil
}
