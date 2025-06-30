package models

import (
	"database/sql"
	"encoding/json"
	"time"
)

// AgentSession represents a persistent agent workflow session
type AgentSession struct {
	ID           int             `json:"id" db:"id"`
	ThreadID     string          `json:"threadId" db:"thread_id"`
	Status       string          `json:"status" db:"status"`
	WorkflowType string          `json:"workflow_type" db:"workflow_type"`
	CurrentStep  string          `json:"current_step" db:"current_step"`
	MealPlan     json.RawMessage `json:"meal_plan,omitempty" db:"meal_plan"`
	ShoppingList string          `json:"shopping_list,omitempty" db:"shopping_list"`
	CreatedAt    time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at" db:"updated_at"`
}

// ChatMessage represents a message in an agent session
type ChatMessage struct {
	ID         int       `json:"id" db:"id"`
	SessionID  int       `json:"session_id" db:"session_id"`
	ThreadID   string    `json:"thread_id" db:"thread_id"`
	Sender     string    `json:"sender" db:"sender"` // "user" or "agent"
	Message    string    `json:"message" db:"message"`
	OrderIndex int       `json:"order_index" db:"order_index"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

// CreateAgentSession creates a new agent session in the database
func CreateAgentSession(db *sql.DB, threadID, workflowType string) (*AgentSession, error) {
	session := &AgentSession{
		ThreadID:     threadID,
		Status:       "ACTIVE",
		WorkflowType: workflowType,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	query := `
		INSERT INTO agent_sessions (thread_id, status, workflow_type, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id`

	err := db.QueryRow(query, session.ThreadID, session.Status, session.WorkflowType, 
		session.CreatedAt, session.UpdatedAt).Scan(&session.ID)
	if err != nil {
		return nil, err
	}

	return session, nil
}

// GetAgentSession retrieves a session by thread ID
func GetAgentSession(db *sql.DB, threadID string) (*AgentSession, error) {
	session := &AgentSession{}

	query := `
		SELECT id, thread_id, status, workflow_type, current_step, meal_plan, 
		       shopping_list, created_at, updated_at
		FROM agent_sessions
		WHERE thread_id = $1`

	var currentStep sql.NullString
	var mealPlan sql.NullString
	var shoppingList sql.NullString
	err := db.QueryRow(query, threadID).Scan(
		&session.ID, &session.ThreadID, &session.Status, &session.WorkflowType,
		&currentStep, &mealPlan, &shoppingList,
		&session.CreatedAt, &session.UpdatedAt)

	if err != nil {
		return nil, err
	}

	// Handle nullable fields
	if currentStep.Valid {
		session.CurrentStep = currentStep.String
	}
	if mealPlan.Valid {
		session.MealPlan = json.RawMessage(mealPlan.String)
	}
	if shoppingList.Valid {
		session.ShoppingList = shoppingList.String
	}

	return session, nil
}

// UpdateAgentSession updates session data
func UpdateAgentSession(db *sql.DB, session *AgentSession) error {
	session.UpdatedAt = time.Now()

	query := `
		UPDATE agent_sessions 
		SET status = $1, current_step = $2, meal_plan = $3, shopping_list = $4, updated_at = $5
		WHERE thread_id = $6`

	_, err := db.Exec(query, session.Status, session.CurrentStep, session.MealPlan,
		session.ShoppingList, session.UpdatedAt, session.ThreadID)

	return err
}

// AddMessage adds a new message to a session
func AddMessage(db *sql.DB, threadID, sender, message string) (*ChatMessage, error) {
	// First get the session ID and next order index
	var sessionID int
	var nextOrder int

	sessionQuery := `SELECT id FROM agent_sessions WHERE thread_id = $1`
	err := db.QueryRow(sessionQuery, threadID).Scan(&sessionID)
	if err != nil {
		return nil, err
	}

	orderQuery := `SELECT COALESCE(MAX(order_index), 0) + 1 FROM agent_messages WHERE session_id = $1`
	err = db.QueryRow(orderQuery, sessionID).Scan(&nextOrder)
	if err != nil {
		return nil, err
	}

	// Insert the message
	chatMessage := &ChatMessage{
		SessionID:  sessionID,
		ThreadID:   threadID,
		Sender:     sender,
		Message:    message,
		OrderIndex: nextOrder,
		CreatedAt:  time.Now(),
	}

	insertQuery := `
		INSERT INTO agent_messages (session_id, thread_id, sender, message, order_index, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id`

	err = db.QueryRow(insertQuery, chatMessage.SessionID, chatMessage.ThreadID,
		chatMessage.Sender, chatMessage.Message, chatMessage.OrderIndex,
		chatMessage.CreatedAt).Scan(&chatMessage.ID)

	if err != nil {
		return nil, err
	}

	return chatMessage, nil
}

// GetMessages retrieves all messages for a session, ordered by order_index
func GetMessages(db *sql.DB, threadID string) ([]ChatMessage, error) {
	query := `
		SELECT id, session_id, thread_id, sender, message, order_index, created_at
		FROM agent_messages
		WHERE thread_id = $1
		ORDER BY order_index ASC`

	rows, err := db.Query(query, threadID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []ChatMessage
	for rows.Next() {
		var msg ChatMessage
		err := rows.Scan(&msg.ID, &msg.SessionID, &msg.ThreadID, &msg.Sender,
			&msg.Message, &msg.OrderIndex, &msg.CreatedAt)
		if err != nil {
			return nil, err
		}
		messages = append(messages, msg)
	}

	return messages, rows.Err()
}

// GetWorkflowCheckpoint retrieves the latest workflow checkpoint data
func GetWorkflowCheckpoint(db *sql.DB, threadID string) (json.RawMessage, string, error) {
	query := `
		SELECT checkpoint_data
		FROM workflow_checkpoints 
		WHERE thread_id = $1 
		ORDER BY updated_at DESC 
		LIMIT 1`

	var checkpointData json.RawMessage
	err := db.QueryRow(query, threadID).Scan(&checkpointData)
	if err != nil {
		return nil, "", err
	}

	// Parse the checkpoint data to extract current_step and meal_plan
	var checkpoint struct {
		ChannelValues struct {
			CurrentStep string          `json:"current_step"`
			MealPlan    json.RawMessage `json:"meal_plan"`
		} `json:"channel_values"`
	}

	if err := json.Unmarshal(checkpointData, &checkpoint); err != nil {
		return checkpointData, "", nil // Return raw data even if parsing fails
	}

	return checkpoint.ChannelValues.MealPlan, checkpoint.ChannelValues.CurrentStep, nil
}

// UpdateWorkflowCheckpoint updates the meal plan in the latest workflow checkpoint
func UpdateWorkflowCheckpoint(db *sql.DB, threadID string, mealPlan json.RawMessage) error {
	// First get the current checkpoint data
	query := `
		SELECT checkpoint_data
		FROM workflow_checkpoints 
		WHERE thread_id = $1 
		ORDER BY updated_at DESC 
		LIMIT 1`

	var currentCheckpointData json.RawMessage
	err := db.QueryRow(query, threadID).Scan(&currentCheckpointData)
	if err != nil {
		return err
	}

	// Parse current checkpoint data
	var checkpoint struct {
		ChannelValues struct {
			CurrentStep string          `json:"current_step"`
			MealPlan    json.RawMessage `json:"meal_plan"`
		} `json:"channel_values"`
	}

	if err := json.Unmarshal(currentCheckpointData, &checkpoint); err != nil {
		return err
	}

	// Update meal plan
	checkpoint.ChannelValues.MealPlan = mealPlan

	// Serialize back
	updatedCheckpointData, err := json.Marshal(checkpoint)
	if err != nil {
		return err
	}

	// Update the checkpoint
	updateQuery := `
		UPDATE workflow_checkpoints 
		SET checkpoint_data = $1, updated_at = CURRENT_TIMESTAMP
		WHERE thread_id = $2 AND checkpoint_ns = (
			SELECT checkpoint_ns 
			FROM workflow_checkpoints 
			WHERE thread_id = $2 
			ORDER BY updated_at DESC 
			LIMIT 1
		)`

	_, err = db.Exec(updateQuery, updatedCheckpointData, threadID)
	return err
}

// UpdateWorkflowCheckpointWithMessage updates the workflow checkpoint with a new message
func UpdateWorkflowCheckpointWithMessage(db *sql.DB, threadID, sender, message string) error {
	// Get all messages for the thread
	messages, err := GetMessages(db, threadID)
	if err != nil {
		return err
	}

	// Add the new message to the list
	messages = append(messages, ChatMessage{
		ThreadID: threadID,
		Sender:   sender,
		Message:  message,
	})

	// Get the current checkpoint data
	query := `
		SELECT checkpoint_data
		FROM workflow_checkpoints 
		WHERE thread_id = $1 
		ORDER BY updated_at DESC 
		LIMIT 1`

	var currentCheckpointData json.RawMessage
	err = db.QueryRow(query, threadID).Scan(&currentCheckpointData)
	if err != nil {
		return err
	}

	// Parse current checkpoint data
	var checkpointData map[string]interface{}
	if err := json.Unmarshal(currentCheckpointData, &checkpointData); err != nil {
		return err
	}

	// Update the messages in the checkpoint
	if channelValues, ok := checkpointData["channel_values"].(map[string]interface{}); ok {
		// Convert messages to the format expected by the workflow
		var formattedMessages []map[string]interface{}
		for _, msg := range messages {
			formattedMessages = append(formattedMessages, map[string]interface{}{
				"role":    msg.Sender,
				"content": msg.Message,
			})
		}
		channelValues["messages"] = formattedMessages
	}

	// Serialize back to JSON
	updatedCheckpointData, err := json.Marshal(checkpointData)
	if err != nil {
		return err
	}

	// Update the checkpoint
	updateQuery := `
		UPDATE workflow_checkpoints 
		SET checkpoint_data = $1, updated_at = CURRENT_TIMESTAMP
		WHERE thread_id = $2 AND checkpoint_ns = (
			SELECT checkpoint_ns 
			FROM workflow_checkpoints 
			WHERE thread_id = $2 
			ORDER BY updated_at DESC 
			LIMIT 1
		)`

	_, err = db.Exec(updateQuery, updatedCheckpointData, threadID)
	return err
}

// DeleteSessionData removes all data for a session (for cleanup)
func DeleteSessionData(db *sql.DB, threadID string) error {
	// Delete messages first (foreign key constraint)
	_, err := db.Exec(`DELETE FROM agent_messages WHERE thread_id = $1`, threadID)
	if err != nil {
		return err
	}

	// Delete session
	_, err = db.Exec(`DELETE FROM agent_sessions WHERE thread_id = $1`, threadID)
	return err
}