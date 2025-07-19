package models

import (
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


