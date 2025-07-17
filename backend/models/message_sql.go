package models

import (
	"database/sql"
	"time"
)

// MessageRecord represents a row in the messages table
type MessageRecord struct {
	ID        int       `json:"id"`
	ThreadID  string    `json:"thread_id"`
	Sender    string    `json:"sender"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

// SaveMessage inserts a new message into the messages table
func SaveMessage(db *sql.DB, threadID, sender, content string) (*MessageRecord, error) {
	const query = `
	INSERT INTO messages (thread_id, sender, content)
	VALUES ($1, $2, $3)
	RETURNING id, thread_id, sender, content, created_at`

	m := &MessageRecord{}
	err := db.QueryRow(query, threadID, sender, content).
		Scan(&m.ID, &m.ThreadID, &m.Sender, &m.Content, &m.CreatedAt)
	if err != nil {
		return nil, err
	}
	return m, nil
}

// GetMessagesForThread retrieves all messages for a thread ordered by creation time
func GetMessagesForThread(db *sql.DB, threadID string) ([]MessageRecord, error) {
	const query = `
	SELECT id, thread_id, sender, content, created_at
	FROM messages
	WHERE thread_id = $1
	ORDER BY created_at`

	rows, err := db.Query(query, threadID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var msgs []MessageRecord
	for rows.Next() {
		var m MessageRecord
		if err := rows.Scan(&m.ID, &m.ThreadID, &m.Sender, &m.Content, &m.CreatedAt); err != nil {
			return nil, err
		}
		msgs = append(msgs, m)
	}
	return msgs, nil
}
