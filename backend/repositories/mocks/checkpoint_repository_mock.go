package mocks

import (
	"context"

	"github.com/stretchr/testify/mock"
	"mealplanner/repositories"
)

// MockCheckpointRepository is a mock implementation of CheckpointRepository for testing
type MockCheckpointRepository struct {
	mock.Mock
}

// GetCheckpoint mock implementation
func (m *MockCheckpointRepository) GetCheckpoint(ctx context.Context, threadID string, ns string) (checkpoint []byte, metadata []byte, found bool, err error) {
	args := m.Called(ctx, threadID, ns)
	return args.Get(0).([]byte), args.Get(1).([]byte), args.Bool(2), args.Error(3)
}

// PutCheckpoint mock implementation
func (m *MockCheckpointRepository) PutCheckpoint(ctx context.Context, threadID string, ns string, workflowType string, checkpoint []byte, metadata []byte) error {
	args := m.Called(ctx, threadID, ns, workflowType, checkpoint, metadata)
	return args.Error(0)
}

// ListCheckpoints mock implementation
func (m *MockCheckpointRepository) ListCheckpoints(ctx context.Context, limit int, before string) ([]repositories.CheckpointRecord, error) {
	args := m.Called(ctx, limit, before)
	return args.Get(0).([]repositories.CheckpointRecord), args.Error(1)
}