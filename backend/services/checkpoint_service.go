package services

import (
	"context"

	"mealplanner/repositories"
)

type checkpointService struct {
	checkpointRepo repositories.CheckpointRepository
}

// NewCheckpointService creates a new checkpoint service
func NewCheckpointService(checkpointRepo repositories.CheckpointRepository) CheckpointService {
	return &checkpointService{checkpointRepo: checkpointRepo}
}

func (s *checkpointService) GetCheckpoint(threadID, ns string) ([]byte, []byte, bool, error) {
	return s.checkpointRepo.GetCheckpoint(context.Background(), threadID, ns)
}

func (s *checkpointService) PutCheckpoint(threadID, ns, workflowType string, checkpoint []byte, metadata []byte) error {
	return s.checkpointRepo.PutCheckpoint(context.Background(), threadID, ns, workflowType, checkpoint, metadata)
}

func (s *checkpointService) ListCheckpoints(limit int, before string) ([]repositories.CheckpointRecord, error) {
	return s.checkpointRepo.ListCheckpoints(context.Background(), limit, before)
}
