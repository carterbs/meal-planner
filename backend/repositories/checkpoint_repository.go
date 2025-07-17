package repositories

import (
	"context"
	"database/sql"
)

// CheckpointRepositoryImpl implements CheckpointRepository using the existing models layer
type CheckpointRepositoryImpl struct {
	db *sql.DB
}

// NewCheckpointRepository creates a new CheckpointRepositoryImpl
func NewCheckpointRepository(db *sql.DB) *CheckpointRepositoryImpl {
	return &CheckpointRepositoryImpl{db: db}
}

// GetCheckpoint retrieves a checkpoint
func (r *CheckpointRepositoryImpl) GetCheckpoint(ctx context.Context, threadID string, ns string) (checkpoint []byte, metadata []byte, found bool, err error) {
	var query string
	var args []any
	if ns != "" {
		query = `SELECT checkpoint_data, metadata FROM workflow_checkpoints WHERE thread_id=$1 AND checkpoint_ns=$2`
		args = []any{threadID, ns}
	} else {
		query = `SELECT checkpoint_data, metadata FROM workflow_checkpoints WHERE thread_id=$1 ORDER BY updated_at DESC LIMIT 1`
		args = []any{threadID}
	}
	var data []byte
	var meta []byte
	err = r.db.QueryRow(query, args...).Scan(&data, &meta)
	if err == sql.ErrNoRows {
		return nil, nil, false, nil
	}
	if err != nil {
		return nil, nil, false, err
	}
	return data, meta, true, nil
}

// PutCheckpoint stores or updates a checkpoint
func (r *CheckpointRepositoryImpl) PutCheckpoint(ctx context.Context, threadID string, ns string, workflowType string, checkpoint []byte, metadata []byte) error {
	const query = `INSERT INTO workflow_checkpoints (thread_id, workflow_type, checkpoint_ns, checkpoint_data, metadata, created_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
    ON CONFLICT (thread_id, checkpoint_ns) DO UPDATE SET checkpoint_data=EXCLUDED.checkpoint_data, metadata=EXCLUDED.metadata, updated_at=NOW()`
	_, err := r.db.Exec(query, threadID, workflowType, ns, checkpoint, metadata)
	return err
}

// ListCheckpoints lists checkpoints with pagination
func (r *CheckpointRepositoryImpl) ListCheckpoints(ctx context.Context, limit int, before string) ([]CheckpointRecord, error) {
	query := `SELECT thread_id, checkpoint_ns, checkpoint_data, metadata FROM workflow_checkpoints ORDER BY thread_id DESC LIMIT $1`
	args := []any{limit}
	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var recs []CheckpointRecord
	for rows.Next() {
		var r CheckpointRecord
		if err := rows.Scan(&r.ThreadID, &r.CheckpointNS, &r.Checkpoint, &r.Metadata); err != nil {
			return nil, err
		}
		recs = append(recs, r)
	}
	return recs, nil
}