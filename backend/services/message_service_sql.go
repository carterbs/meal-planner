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
	return models.GetMessages(s.db, threadID)
}

// GetMessagesWithTimestamps retrieves messages with timestamps via the messages table
func (s *sqlMessageService) GetMessagesWithTimestamps(threadID string) ([]map[string]interface{}, error) {
	return models.GetMessagesForProtobuf(s.db, threadID)
}

// AddMessage saves a new message into the messages table
func (s *sqlMessageService) AddMessage(threadID, sender, message string) (models.ChatMessage, error) {
	err := models.AddMessage(s.db, threadID, sender, message)
	if err != nil {
		return models.ChatMessage{}, err
	}
	return models.ChatMessage{Sender: sender, Text: message}, nil
}

// UpdateWorkflowCheckpointWithMessage is unsupported in SQLMessageService
func (s *sqlMessageService) UpdateWorkflowCheckpointWithMessage(threadID, sender, message string) error {
	// nop
	return nil
}
