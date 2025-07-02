package services

import (
	"database/sql"
	"fmt"

	"mealplanner/logging"
	"mealplanner/models"
)

type messageService struct {
	db *sql.DB
}

var messageServiceLogger = logging.GetLogger("message-service")

// NewMessageService creates a new message service instance
func NewMessageService(db *sql.DB) MessageService {
	return &messageService{db: db}
}

// GetMessages retrieves chat messages for a thread
func (s *messageService) GetMessages(threadID string) ([]models.ChatMessage, error) {
	messageServiceLogger.Debugw("Getting messages for thread ID", "threadID", threadID)
	messages, err := models.GetMessages(s.db, threadID)
	if err != nil {
		messageServiceLogger.Errorw("Failed to get messages for thread ID", "threadID", threadID, "error", err)
		return nil, fmt.Errorf("failed to get messages for thread ID %s: %w", threadID, err)
	}
	messageServiceLogger.Debugw("Retrieved messages for thread ID", "count", len(messages), "threadID", threadID)
	return messages, nil
}

// AddMessage adds a new message to a thread
func (s *messageService) AddMessage(threadID, sender, message string) (models.ChatMessage, error) {
	messageServiceLogger.Debugw("Adding message to thread ID", "threadID", threadID, "sender", sender)
	chatMessage, err := models.AddMessage(s.db, threadID, sender, message)
	if err != nil {
		messageServiceLogger.Errorw("Failed to add message to thread ID", "threadID", threadID, "error", err)
		return models.ChatMessage{}, fmt.Errorf("failed to add message to thread ID %s: %w", threadID, err)
	}
	messageServiceLogger.Debugw("Successfully added message to thread ID", "threadID", threadID, "sender", sender)
	return chatMessage, nil
}

// UpdateWorkflowCheckpointWithMessage updates workflow checkpoint with a new message
func (s *messageService) UpdateWorkflowCheckpointWithMessage(threadID, sender, message string) error {
	messageServiceLogger.Debugw("Updating workflow checkpoint with message for thread ID", "threadID", threadID, "sender", sender)
	err := models.UpdateWorkflowCheckpointWithMessage(s.db, threadID, sender, message)
	if err != nil {
		messageServiceLogger.Errorw("Failed to update workflow checkpoint with message for thread ID", "threadID", threadID, "error", err)
		return fmt.Errorf("failed to update workflow checkpoint with message for thread ID %s: %w", threadID, err)
	}
	messageServiceLogger.Debugw("Successfully updated workflow checkpoint with message for thread ID", "threadID", threadID)
	return nil
}