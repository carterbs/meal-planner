package services

import (
	"context"
	"fmt"

	"mealplanner/logging"
	"mealplanner/models"
	"mealplanner/repositories"
)

type messageService struct {
	workflowRepo repositories.WorkflowRepository
}

var messageServiceLogger = logging.GetGrpcLogger("message-service")

// NewMessageService creates a new message service instance
func NewMessageService(workflowRepo repositories.WorkflowRepository) MessageService {
	return &messageService{workflowRepo: workflowRepo}
}

// GetMessages retrieves chat messages for a thread
func (s *messageService) GetMessages(threadID string) ([]models.ChatMessage, error) {
	messageServiceLogger.Debugw("Getting messages for thread ID", "threadID", threadID)
	if s.workflowRepo == nil {
		return nil, fmt.Errorf("workflow repository is nil")
	}
	messages, err := s.workflowRepo.GetMessages(context.Background(), threadID)
	if err != nil {
		messageServiceLogger.Errorw("Failed to get messages for thread ID", "threadID", threadID, "error", err)
		return nil, fmt.Errorf("failed to get messages for thread ID %s: %w", threadID, err)
	}
	messageServiceLogger.Debugw("Retrieved messages for thread ID", "count", len(messages), "threadID", threadID)
	return messages, nil
}

// GetMessagesWithTimestamps retrieves chat messages with timestamps for a thread
func (s *messageService) GetMessagesWithTimestamps(threadID string) ([]map[string]interface{}, error) {
	messageServiceLogger.Debugw("Getting messages with timestamps for thread ID", "threadID", threadID)
	if s.workflowRepo == nil {
		return nil, fmt.Errorf("workflow repository is nil")
	}
	messages, err := s.workflowRepo.GetMessagesForProtobuf(context.Background(), threadID)
	if err != nil {
		messageServiceLogger.Errorw("Failed to get messages with timestamps for thread ID", "threadID", threadID, "error", err)
		return nil, fmt.Errorf("failed to get messages with timestamps for thread ID %s: %w", threadID, err)
	}
	messageServiceLogger.Debugw("Retrieved messages with timestamps for thread ID", "count", len(messages), "threadID", threadID)
	return messages, nil
}

// AddMessage adds a new message to a thread
func (s *messageService) AddMessage(threadID, sender, message string) (models.ChatMessage, error) {
	messageServiceLogger.Debugw("Adding message to thread ID", "threadID", threadID, "sender", sender)
	if s.workflowRepo == nil {
		return models.ChatMessage{}, fmt.Errorf("workflow repository is nil")
	}
	err := s.workflowRepo.AddMessage(context.Background(), threadID, sender, message)
	if err != nil {
		messageServiceLogger.Errorw("Failed to add message to thread ID", "threadID", threadID, "error", err)
		return models.ChatMessage{}, fmt.Errorf("failed to add message to thread ID %s: %w", threadID, err)
	}
	chatMessage := models.ChatMessage{Sender: sender, Text: message}
	messageServiceLogger.Debugw("Successfully added message to thread ID", "threadID", threadID, "sender", sender)
	return chatMessage, nil
}

// UpdateWorkflowCheckpointWithMessage adds a message to the messages table
func (s *messageService) UpdateWorkflowCheckpointWithMessage(threadID, sender, message string) error {
	messageServiceLogger.Debugw("Adding message to messages table for thread ID", "threadID", threadID, "sender", sender)
	if s.workflowRepo == nil {
		return fmt.Errorf("workflow repository is nil")
	}
	err := s.workflowRepo.AddMessage(context.Background(), threadID, sender, message)
	if err != nil {
		messageServiceLogger.Errorw("Failed to add message to messages table for thread ID", "threadID", threadID, "error", err)
		return fmt.Errorf("failed to add message to messages table for thread ID %s: %w", threadID, err)
	}
	messageServiceLogger.Debugw("Successfully added message to messages table for thread ID", "threadID", threadID)
	return nil
}
