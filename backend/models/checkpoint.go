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
	const query = `
		INSERT INTO workflow_checkpoints (thread_id, workflow_type, checkpoint_ns, checkpoint_data, created_at, updated_at)
		VALUES ($1, '', 'latest', $2, NOW(), NOW())
		ON CONFLICT (thread_id, checkpoint_ns)
		DO UPDATE SET checkpoint_data = EXCLUDED.checkpoint_data, updated_at = NOW()`
	_, err := db.Exec(query, threadID, data)
	return err
}

// UpdateWorkflowCheckpointWithMessage appends a message to the checkpoint_data messages list
func UpdateWorkflowCheckpointWithMessage(db *sql.DB, threadID, sender, message string) error {
	data, _, err := GetWorkflowCheckpoint(db, threadID)
	if err != nil {
		return err
	}
	// Unmarshal existing data
	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		return fmt.Errorf("failed to unmarshal checkpoint: %w", err)
	}
	// Append to messages
	msgs, ok := m["messages"].([]interface{})
	if !ok {
		msgs = []interface{}{}
	}
	msgs = append(msgs, map[string]interface{}{
		"sender": sender,
		"text":   message,
		"time":   time.Now().Format(time.RFC3339),
	})
	m["messages"] = msgs
	// Marshal back
	newData, err := json.Marshal(m)
	if err != nil {
		return fmt.Errorf("failed to marshal checkpoint: %w", err)
	}
	// Upsert
	return UpdateWorkflowCheckpoint(db, threadID, newData)
}

// GetMessages extracts chat messages from the latest checkpoint_data
func GetMessages(db *sql.DB, threadID string) ([]ChatMessage, error) {
	data, _, err := GetWorkflowCheckpoint(db, threadID)
	if err != nil {
		return nil, err
	}
	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("failed to unmarshal checkpoint: %w", err)
	}
	arr, ok := m["messages"].([]interface{})
	if !ok {
		return []ChatMessage{}, nil
	}
	var msgs []ChatMessage
	for _, v := range arr {
		if vm, ok := v.(map[string]interface{}); ok {
			sender, _ := vm["sender"].(string)
			text, _ := vm["text"].(string)
			msgs = append(msgs, ChatMessage{Sender: sender, Text: text})
		}
	}
	return msgs, nil
}

// AddMessage appends a message and returns it
func AddMessage(db *sql.DB, threadID, sender, message string) (ChatMessage, error) {
	err := UpdateWorkflowCheckpointWithMessage(db, threadID, sender, message)
	if err != nil {
		return ChatMessage{}, err
	}
	return ChatMessage{Sender: sender, Text: message}, nil
}
