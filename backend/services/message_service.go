package services

import (
	"database/sql"
	"fmt"
	"log"

	"mealplanner/models"
)

type messageService struct {
	db *sql.DB
}

// NewMessageService creates a new message service instance
func NewMessageService(db *sql.DB) MessageService {
	return &messageService{db: db}
}

// GetMessages retrieves chat messages for a thread
func (s *messageService) GetMessages(threadID string) ([]models.ChatMessage, error) {
	log.Printf("Getting messages for thread ID: %s", threadID)
	messages, err := models.GetMessages(s.db, threadID)
	if err != nil {
		log.Printf("Failed to get messages for thread ID %s: %v", threadID, err)
		return nil, fmt.Errorf("failed to get messages for thread ID %s: %w", threadID, err)
	}
	log.Printf("Retrieved %d messages for thread ID %s", len(messages), threadID)
	return messages, nil
}

// AddMessage adds a new message to a thread
func (s *messageService) AddMessage(threadID, sender, message string) (models.ChatMessage, error) {
	log.Printf("Adding message to thread ID %s from sender %s", threadID, sender)
	chatMessage, err := models.AddMessage(s.db, threadID, sender, message)
	if err != nil {
		log.Printf("Failed to add message to thread ID %s: %v", threadID, err)
		return models.ChatMessage{}, fmt.Errorf("failed to add message to thread ID %s: %w", threadID, err)
	}
	log.Printf("Successfully added message to thread ID %s from sender %s", threadID, sender)
	return chatMessage, nil
}

// UpdateWorkflowCheckpointWithMessage updates workflow checkpoint with a new message
func (s *messageService) UpdateWorkflowCheckpointWithMessage(threadID, sender, message string) error {
	log.Printf("Updating workflow checkpoint with message for thread ID %s from sender %s", threadID, sender)
	err := models.UpdateWorkflowCheckpointWithMessage(s.db, threadID, sender, message)
	if err != nil {
		log.Printf("Failed to update workflow checkpoint with message for thread ID %s: %v", threadID, err)
		return fmt.Errorf("failed to update workflow checkpoint with message for thread ID %s: %w", threadID, err)
	}
	log.Printf("Successfully updated workflow checkpoint with message for thread ID %s", threadID)
	return nil
}