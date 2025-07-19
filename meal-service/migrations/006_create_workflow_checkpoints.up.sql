CREATE TABLE workflow_checkpoints (
  thread_id VARCHAR(255) NOT NULL,
  workflow_type VARCHAR(50) NOT NULL,
  checkpoint_ns VARCHAR(255) NOT NULL,
  checkpoint_data JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (thread_id, checkpoint_ns)
);

-- Add indexes for performance
CREATE INDEX idx_workflow_checkpoints_type ON workflow_checkpoints(workflow_type);
CREATE INDEX idx_workflow_checkpoints_ns ON workflow_checkpoints(checkpoint_ns);
CREATE INDEX idx_workflow_checkpoints_created ON workflow_checkpoints(created_at);
CREATE INDEX idx_workflow_checkpoints_type_created ON workflow_checkpoints(workflow_type, created_at);