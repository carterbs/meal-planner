package services

import (
	"database/sql"
	"mealplanner/models"
)

// SQLMessageService implements MessageService using the messages table
func SQLMessageService(db *sql.DB) MessageService {
	return &sqlMessageService{db: db}
}

type sqlMessageService struct {
	db *sql.DB
}

// GetMessages retrieves messages via the messages table
func (s *sqlMessageService) GetMessages(threadID string) ([]models.ChatMessage, error) {
	msgs, err := models.GetMessagesForThread(s.db, threadID)
	if err != nil {
		return nil, err
	}
	var out []models.ChatMessage
	for _, m := range msgs {
		out = append(out, models.ChatMessage{Sender: m.Sender, Text: m.Content})
	}
	return out, nil
}

// AddMessage saves a new message into the messages table
func (s *sqlMessageService) AddMessage(threadID, sender, message string) (models.ChatMessage, error) {
	m, err := models.SaveMessage(s.db, threadID, sender, message)
	if err != nil {
		return models.ChatMessage{}, err
	}
	return models.ChatMessage{Sender: m.Sender, Text: m.Content}, nil
}

// UpdateWorkflowCheckpointWithMessage is unsupported in SQLMessageService
func (s *sqlMessageService) UpdateWorkflowCheckpointWithMessage(threadID, sender, message string) error {
	// nop
	return nil
}
