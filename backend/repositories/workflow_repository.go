package repositories

import (
	"context"
	"database/sql"

	"mealplanner/models"
)

// WorkflowRepositoryImpl implements WorkflowRepository using the existing models layer
type WorkflowRepositoryImpl struct {
	db *sql.DB
}

// NewWorkflowRepository creates a new WorkflowRepositoryImpl
func NewWorkflowRepository(db *sql.DB) *WorkflowRepositoryImpl {
	return &WorkflowRepositoryImpl{db: db}
}

// GetWorkflowCheckpoint retrieves a workflow checkpoint
func (r *WorkflowRepositoryImpl) GetWorkflowCheckpoint(ctx context.Context, threadID string) ([]byte, string, error) {
	return models.GetWorkflowCheckpoint(r.db, threadID)
}

// UpdateWorkflowCheckpoint updates a workflow checkpoint
func (r *WorkflowRepositoryImpl) UpdateWorkflowCheckpoint(ctx context.Context, threadID string, data []byte) error {
	return models.UpdateWorkflowCheckpoint(r.db, threadID, data)
}

// ListWorkflows lists workflow summaries
func (r *WorkflowRepositoryImpl) ListWorkflows(ctx context.Context, limit int) ([]models.WorkflowStatus, error) {
	return models.ListWorkflows(r.db, limit)
}

// AddMessage adds a message to a workflow
func (r *WorkflowRepositoryImpl) AddMessage(ctx context.Context, threadID string, sender string, message string) error {
	return models.AddMessage(r.db, threadID, sender, message)
}

// GetMessages retrieves messages for a workflow
func (r *WorkflowRepositoryImpl) GetMessages(ctx context.Context, threadID string) ([]models.ChatMessage, error) {
	return models.GetMessages(r.db, threadID)
}

// GetMessagesForProtobuf retrieves messages with timestamps for protobuf conversion
func (r *WorkflowRepositoryImpl) GetMessagesForProtobuf(ctx context.Context, threadID string) ([]map[string]interface{}, error) {
	return models.GetMessagesForProtobuf(r.db, threadID)
}