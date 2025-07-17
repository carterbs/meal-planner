package mocks

import (
	"context"
	"github.com/stretchr/testify/mock"
	"mealplanner/models"
)

type MockWorkflowRepository struct {
	mock.Mock
}

func NewMockWorkflowRepository(t interface {
	mock.TestingT
	Cleanup(func())
}) *MockWorkflowRepository {
	mock := &MockWorkflowRepository{}
	mock.Mock.Test(t)

	t.Cleanup(func() { mock.AssertExpectations(t) })

	return mock
}

func (m *MockWorkflowRepository) GetWorkflowCheckpoint(ctx context.Context, threadID string) ([]byte, string, error) {
	args := m.Called(ctx, threadID)

	var data []byte
	if d := args.Get(0); d != nil {
		data = d.([]byte)
	}

	var namespace string
	if ns, ok := args.Get(1).(string); ok {
		namespace = ns
	}

	return data, namespace, args.Error(2)
}

func (m *MockWorkflowRepository) UpdateWorkflowCheckpoint(ctx context.Context, threadID string, data []byte) error {
	args := m.Called(ctx, threadID, data)
	return args.Error(0)
}

func (m *MockWorkflowRepository) AddMessage(ctx context.Context, threadID, sender, message string) error {
	args := m.Called(ctx, threadID, sender, message)
	return args.Error(0)
}

func (m *MockWorkflowRepository) ListWorkflows(ctx context.Context, limit int) ([]models.WorkflowStatus, error) {
	args := m.Called(ctx, limit)
	var statuses []models.WorkflowStatus
	if s := args.Get(0); s != nil {
		statuses = s.([]models.WorkflowStatus)
	}
	return statuses, args.Error(1)
}

func (m *MockWorkflowRepository) GetMessages(ctx context.Context, threadID string) ([]models.ChatMessage, error) {
    args := m.Called(ctx, threadID)
    return args.Get(0).([]models.ChatMessage), args.Error(1)
}

func (m *MockWorkflowRepository) GetMessagesForProtobuf(ctx context.Context, threadID string) ([]map[string]interface{}, error) {
    args := m.Called(ctx, threadID)
    return args.Get(0).([]map[string]interface{}), args.Error(1)
}