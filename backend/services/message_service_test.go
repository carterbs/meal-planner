package services

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"mealplanner/models"
	"mealplanner/repositories/mocks"
	"mealplanner/testutil"
)

func TestMessageService_GetMessages(t *testing.T) {
	tests := []struct {
		name             string
		threadID         string
		setupMocks       func(*mocks.MockWorkflowRepository)
		expectedMessages []models.ChatMessage
		expectedErr      string
	}{
		{
			name:     "successful retrieval with multiple messages",
			threadID: testutil.TestThreadID,
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				expectedMessages := []models.ChatMessage{
					{Sender: "user", Text: "Hello, I need help with meal planning"},
					{Sender: "agent", Text: "I'd be happy to help you with meal planning!"},
					{Sender: "user", Text: "Can you suggest some healthy dinner options?"},
				}
				mockRepo.On("GetMessages", mock.Anything, testutil.TestThreadID).Return(expectedMessages, nil)
			},
			expectedMessages: []models.ChatMessage{
				{Sender: "user", Text: "Hello, I need help with meal planning"},
				{Sender: "agent", Text: "I'd be happy to help you with meal planning!"},
				{Sender: "user", Text: "Can you suggest some healthy dinner options?"},
			},
		},
		{
			name:     "successful retrieval with empty messages",
			threadID: testutil.TestThreadID,
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("GetMessages", mock.Anything, testutil.TestThreadID).Return([]models.ChatMessage{}, nil)
			},
			expectedMessages: []models.ChatMessage{},
		},
		{
			name:     "database error during retrieval",
			threadID: testutil.TestThreadID,
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("GetMessages", mock.Anything, testutil.TestThreadID).Return([]models.ChatMessage(nil), testutil.ErrTestDatabase)
			},
			expectedErr: "failed to get messages for thread ID",
		},
		{
			name:     "empty thread ID",
			threadID: "",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("GetMessages", mock.Anything, "").Return([]models.ChatMessage{}, nil)
			},
			expectedMessages: []models.ChatMessage{},
		},
		{
			name:     "nil workflow repository",
			threadID: testutil.TestThreadID,
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				// No setup needed for nil repo test
			},
			expectedErr: "workflow repository is nil",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mockRepo := new(mocks.MockWorkflowRepository)
			tt.setupMocks(mockRepo)

			var service MessageService
			if tt.expectedErr == "workflow repository is nil" {
				service = NewMessageService(nil)
			} else {
				service = NewMessageService(mockRepo)
			}

			// Execute
			messages, err := service.GetMessages(tt.threadID)

			// Assert
			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
				assert.Nil(t, messages)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedMessages, messages)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestMessageService_GetMessagesWithTimestamps(t *testing.T) {
	tests := []struct {
		name             string
		threadID         string
		setupMocks       func(*mocks.MockWorkflowRepository)
		expectedMessages []map[string]interface{}
		expectedErr      string
	}{
		{
			name:     "successful retrieval with timestamps",
			threadID: testutil.TestThreadID,
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				expectedMessages := []map[string]interface{}{
					{
						"sender":    "user",
						"text":      "Hello",
						"timestamp": "2023-01-01T12:00:00Z",
					},
					{
						"sender":    "agent",
						"text":      "Hi there!",
						"timestamp": "2023-01-01T12:01:00Z",
					},
				}
				mockRepo.On("GetMessagesForProtobuf", mock.Anything, testutil.TestThreadID).Return(expectedMessages, nil)
			},
			expectedMessages: []map[string]interface{}{
				{
					"sender":    "user",
					"text":      "Hello",
					"timestamp": "2023-01-01T12:00:00Z",
				},
				{
					"sender":    "agent",
					"text":      "Hi there!",
					"timestamp": "2023-01-01T12:01:00Z",
				},
			},
		},
		{
			name:     "empty result set",
			threadID: testutil.TestThreadID,
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("GetMessagesForProtobuf", mock.Anything, testutil.TestThreadID).Return([]map[string]interface{}{}, nil)
			},
			expectedMessages: []map[string]interface{}{},
		},
		{
			name:     "database error",
			threadID: testutil.TestThreadID,
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("GetMessagesForProtobuf", mock.Anything, testutil.TestThreadID).Return([]map[string]interface{}(nil), testutil.ErrTestDatabase)
			},
			expectedErr: "failed to get messages with timestamps for thread ID",
		},
		{
			name:     "complex message with special characters",
			threadID: "thread-with-unicode-🚀",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				expectedMessages := []map[string]interface{}{
					{
						"sender":    "user",
						"text":      "Can you help me with meal planning? 🍕🥗",
						"timestamp": "2023-01-01T12:00:00Z",
					},
				}
				mockRepo.On("GetMessagesForProtobuf", mock.Anything, "thread-with-unicode-🚀").Return(expectedMessages, nil)
			},
			expectedMessages: []map[string]interface{}{
				{
					"sender":    "user",
					"text":      "Can you help me with meal planning? 🍕🥗",
					"timestamp": "2023-01-01T12:00:00Z",
				},
			},
		},
		{
			name:     "nil workflow repository",
			threadID: testutil.TestThreadID,
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				// No setup needed for nil repo test
			},
			expectedErr: "workflow repository is nil",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mockRepo := new(mocks.MockWorkflowRepository)
			tt.setupMocks(mockRepo)

			var service MessageService
			if tt.expectedErr == "workflow repository is nil" {
				service = NewMessageService(nil)
			} else {
				service = NewMessageService(mockRepo)
			}

			// Execute
			messages, err := service.GetMessagesWithTimestamps(tt.threadID)

			// Assert
			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
				assert.Nil(t, messages)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedMessages, messages)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestMessageService_AddMessage(t *testing.T) {
	tests := []struct {
		name            string
		threadID        string
		sender          string
		message         string
		setupMocks      func(*mocks.MockWorkflowRepository)
		expectedMessage models.ChatMessage
		expectedErr     string
	}{
		{
			name:     "successful user message addition",
			threadID: testutil.TestThreadID,
			sender:   "user",
			message:  "Hello, I need help with meal planning",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("AddMessage", mock.Anything, testutil.TestThreadID, "user", "Hello, I need help with meal planning").Return(nil)
			},
			expectedMessage: models.ChatMessage{
				Sender: "user",
				Text:   "Hello, I need help with meal planning",
			},
		},
		{
			name:     "successful agent message addition",
			threadID: testutil.TestThreadID,
			sender:   "agent",
			message:  "I'd be happy to help you with meal planning!",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("AddMessage", mock.Anything, testutil.TestThreadID, "agent", "I'd be happy to help you with meal planning!").Return(nil)
			},
			expectedMessage: models.ChatMessage{
				Sender: "agent",
				Text:   "I'd be happy to help you with meal planning!",
			},
		},
		{
			name:     "database error during addition",
			threadID: testutil.TestThreadID,
			sender:   "user",
			message:  "Test message",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("AddMessage", mock.Anything, testutil.TestThreadID, "user", "Test message").Return(testutil.ErrTestDatabase)
			},
			expectedErr: "failed to add message to thread ID",
		},
		{
			name:     "empty message text",
			threadID: testutil.TestThreadID,
			sender:   "user",
			message:  "",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("AddMessage", mock.Anything, testutil.TestThreadID, "user", "").Return(nil)
			},
			expectedMessage: models.ChatMessage{
				Sender: "user",
				Text:   "",
			},
		},
		{
			name:     "very long message",
			threadID: testutil.TestThreadID,
			sender:   "user",
			message:  "This is a very long message that contains a lot of text to test how the system handles longer messages that might be common in meal planning conversations where users provide detailed information about their dietary preferences and restrictions and specific requirements for their meal plans",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("AddMessage", mock.Anything, testutil.TestThreadID, "user", "This is a very long message that contains a lot of text to test how the system handles longer messages that might be common in meal planning conversations where users provide detailed information about their dietary preferences and restrictions and specific requirements for their meal plans").Return(nil)
			},
			expectedMessage: models.ChatMessage{
				Sender: "user",
				Text:   "This is a very long message that contains a lot of text to test how the system handles longer messages that might be common in meal planning conversations where users provide detailed information about their dietary preferences and restrictions and specific requirements for their meal plans",
			},
		},
		{
			name:     "message with special characters and unicode",
			threadID: testutil.TestThreadID,
			sender:   "user",
			message:  "I'd like meals with these ingredients: 🥩 beef, 🥕 carrots, 🧄 garlic, and spices like café au lait flavoring!",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("AddMessage", mock.Anything, testutil.TestThreadID, "user", "I'd like meals with these ingredients: 🥩 beef, 🥕 carrots, 🧄 garlic, and spices like café au lait flavoring!").Return(nil)
			},
			expectedMessage: models.ChatMessage{
				Sender: "user",
				Text:   "I'd like meals with these ingredients: 🥩 beef, 🥕 carrots, 🧄 garlic, and spices like café au lait flavoring!",
			},
		},
		{
			name:     "nil workflow repository",
			threadID: testutil.TestThreadID,
			sender:   "user",
			message:  "Test message",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				// No setup needed for nil repo test
			},
			expectedErr: "workflow repository is nil",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mockRepo := new(mocks.MockWorkflowRepository)
			tt.setupMocks(mockRepo)

			var service MessageService
			if tt.expectedErr == "workflow repository is nil" {
				service = NewMessageService(nil)
			} else {
				service = NewMessageService(mockRepo)
			}

			// Execute
			message, err := service.AddMessage(tt.threadID, tt.sender, tt.message)

			// Assert
			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
				assert.Equal(t, models.ChatMessage{}, message)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedMessage, message)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestMessageService_UpdateWorkflowCheckpointWithMessage(t *testing.T) {
	tests := []struct {
		name       string
		threadID   string
		sender     string
		message    string
		setupMocks func(*mocks.MockWorkflowRepository)
		expectedErr string
	}{
		{
			name:     "successful message addition to workflow checkpoint",
			threadID: testutil.TestThreadID,
			sender:   "user",
			message:  "I want to update my meal plan",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("AddMessage", mock.Anything, testutil.TestThreadID, "user", "I want to update my meal plan").Return(nil)
			},
		},
		{
			name:     "database error during workflow checkpoint update",
			threadID: testutil.TestThreadID,
			sender:   "user",
			message:  "Test message",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("AddMessage", mock.Anything, testutil.TestThreadID, "user", "Test message").Return(testutil.ErrTestDatabase)
			},
			expectedErr: "failed to add message to messages table for thread ID",
		},
		{
			name:     "empty thread ID",
			threadID: "",
			sender:   "user",
			message:  "Test message",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("AddMessage", mock.Anything, "", "user", "Test message").Return(nil)
			},
		},
		{
			name:     "empty sender",
			threadID: testutil.TestThreadID,
			sender:   "",
			message:  "Test message",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("AddMessage", mock.Anything, testutil.TestThreadID, "", "Test message").Return(nil)
			},
		},
		{
			name:     "concurrent message addition",
			threadID: testutil.TestThreadID,
			sender:   "user",
			message:  "Concurrent test message",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("AddMessage", mock.Anything, testutil.TestThreadID, "user", "Concurrent test message").Return(nil)
			},
		},
		{
			name:     "nil workflow repository",
			threadID: testutil.TestThreadID,
			sender:   "user",
			message:  "Test message",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				// No setup needed for nil repo test
			},
			expectedErr: "workflow repository is nil",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mockRepo := new(mocks.MockWorkflowRepository)
			tt.setupMocks(mockRepo)

			var service MessageService
			if tt.expectedErr == "workflow repository is nil" {
				service = NewMessageService(nil)
			} else {
				service = NewMessageService(mockRepo)
			}

			// Execute
			err := service.UpdateWorkflowCheckpointWithMessage(tt.threadID, tt.sender, tt.message)

			// Assert
			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestMessageService_EdgeCases(t *testing.T) {
	tests := []struct {
		name     string
		threadID string
		sender   string
		message  string
	}{
		{
			name:     "SQL injection attempt in thread ID",
			threadID: "'; DROP TABLE messages; --",
			sender:   "user",
			message:  "Test message",
		},
		{
			name:     "very large message handling",
			threadID: testutil.TestThreadID,
			sender:   "user",
			message:  string(make([]byte, 1024*1024)), // 1MB message
		},
		{
			name:     "special characters in all fields",
			threadID: "thread-🚀-test",
			sender:   "user-🎯",
			message:  "Message with special chars: !@#$%^&*()_+-=[]{}|;':\",./<>?",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mockRepo := new(mocks.MockWorkflowRepository)
			mockRepo.On("GetMessages", mock.Anything, tt.threadID).Return([]models.ChatMessage{}, nil)
			mockRepo.On("AddMessage", mock.Anything, tt.threadID, tt.sender, tt.message).Return(nil)

			service := NewMessageService(mockRepo)
			
			// Execute tests that check service behavior
			_, err := service.GetMessages(tt.threadID)
			assert.NoError(t, err) // Should work with proper mocking
			
			_, err = service.AddMessage(tt.threadID, tt.sender, tt.message)
			assert.NoError(t, err) // Should work with proper mocking

			mockRepo.AssertExpectations(t)
		})
	}
} 