import { Pool } from 'pg';
import { getDatabase } from './connection';
import { CheckpointRecord, WorkflowStatus } from './models';
import {
  AgentCheckpoint,
  AgentCheckpointMetadata,
} from '@mealplanner/generated';
import { errorLog } from '../logging';
export class CheckpointRepository {
  private db: Pool;
  constructor() {
    this.db = getDatabase();
  }
  // GetCheckpoint retrieves a checkpoint - matches Go repository implementation
  async getCheckpoint(
    threadID: string,
    ns: string,
  ): Promise<{
    checkpoint: Buffer | null;
    metadata: Buffer | null;
    found: boolean;
  }> {
    let query: string;
    let args: Array<string | number>;
    if (ns !== 'latest') {
      query = `SELECT checkpoint_data, metadata FROM workflow_checkpoints WHERE thread_id=$1 AND checkpoint_ns=$2`;
      args = [threadID, ns];
    } else {
      query = `SELECT checkpoint_data, metadata FROM workflow_checkpoints WHERE thread_id=$1 ORDER BY updated_at DESC LIMIT 1`;
      args = [threadID];
    }
    try {
      const result = await this.db.query<{
        checkpoint_data: unknown;
        metadata: unknown;
      }>(query, args);
      if (result.rows.length === 0) {
        return { checkpoint: null, metadata: null, found: false };
      }
      const row = result.rows[0];
      // PostgreSQL returns JSONB as objects, but we need JSON strings for parsing
      const checkpointBuffer = Buffer.from(
        JSON.stringify(row.checkpoint_data),
        'utf8',
      );
      const metadataBuffer = row.metadata
        ? Buffer.from(JSON.stringify(row.metadata), 'utf8')
        : null;
      return {
        checkpoint: checkpointBuffer,
        metadata: metadataBuffer,
        found: true,
      };
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
  // PutCheckpoint stores or updates a checkpoint - matches Go repository implementation
  async putCheckpoint(
    threadID: string,
    ns: string,
    workflowType: string,
    checkpoint: AgentCheckpoint,
    metadata: AgentCheckpointMetadata,
  ): Promise<void> {
    const query = `INSERT INTO workflow_checkpoints (thread_id, workflow_type, checkpoint_ns, checkpoint_data, metadata, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
      ON CONFLICT (thread_id, checkpoint_ns) DO UPDATE SET checkpoint_data=EXCLUDED.checkpoint_data, metadata=EXCLUDED.metadata, updated_at=NOW()`;
    // Serialize to canonical protobuf-JSON so well-known types like Timestamp
    // are rendered as RFC-3339 strings instead of {seconds,nanos} objects.
    // `toJsonString()` is provided by @bufbuild/protobuf Message.
    const checkpointJson = checkpoint.toJsonString();
    const metadataJson = metadata.toJsonString();
    await this.db.query(query, [
      threadID,
      workflowType,
      ns,
      checkpointJson,
      metadataJson,
    ]);
  }
  // ListCheckpoints lists checkpoints with pagination - matches Go repository implementation
  async listCheckpoints(
    limit: number,
    _before: string,
  ): Promise<CheckpointRecord[]> {
    const query = `SELECT thread_id, checkpoint_ns, checkpoint_data, metadata FROM workflow_checkpoints ORDER BY thread_id DESC LIMIT $1`;
    const args = [limit];
    const result = await this.db.query<{
      thread_id: string;
      checkpoint_ns: string;
      checkpoint_data: unknown;
      metadata: unknown;
    }>(query, args);
    return result.rows.map((row) => ({
      thread_id: row.thread_id,
      checkpoint_ns: row.checkpoint_ns,
      checkpoint_data: row.checkpoint_data,
      metadata: row.metadata,
    }));
  }
  // GetWorkflowCheckpoint retrieves the latest checkpoint data for a thread - matches Go models/checkpoint.go
  async getWorkflowCheckpoint(threadID: string): Promise<{
    data: Buffer | null;
    ns: string | null;
  }> {
    const query = `
      SELECT checkpoint_data, checkpoint_ns
      FROM workflow_checkpoints
      WHERE thread_id = $1
      ORDER BY updated_at DESC
      LIMIT 1`;
    try {
      const result = await this.db.query<{
        checkpoint_data: Buffer | null;
        checkpoint_ns: string;
      }>(query, [threadID]);
      if (result.rows.length === 0) {
        return { data: null, ns: null };
      }
      const row = result.rows[0];
      return {
        data: row.checkpoint_data,
        ns: row.checkpoint_ns,
      };
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
  // UpdateWorkflowCheckpoint upserts checkpoint_data for a thread under namespace "latest" - matches Go models/checkpoint.go
  async updateWorkflowCheckpoint(
    threadID: string,
    data: AgentCheckpoint,
  ): Promise<void> {
    // Extract workflow_type from the checkpoint JSON so that the `latest`
    // row always has a non-empty workflow_type. This prevents downstream
    // consumers (agent resume, listWorkflows, etc.) from seeing an empty
    // value when they load the most-recent checkpoint.
    let wfType = '';
    try {
      const generic: unknown = JSON.parse(JSON.stringify(data));
      const isRecord = (v: unknown): v is Record<string, unknown> =>
        typeof v === 'object' && v !== null;
      if (isRecord(generic)) {
          const candidateState = generic.state;
          const state = isRecord(candidateState) ? candidateState : undefined;
        if (
          state &&
          typeof state.workflow_type === 'string' &&
          state.workflow_type !== ''
        ) {
          wfType = state.workflow_type;
        }
        if (wfType === '') {
          const topWorkflowType = generic.workflow_type;
          if (typeof topWorkflowType === 'string' && topWorkflowType !== '') {
            wfType = topWorkflowType;
          }
        }
      }
    } catch {
      // If parsing fails, continue with default
    }
    if (wfType === '') {
      wfType = 'meal_planning';
    }
    const query = `
      INSERT INTO workflow_checkpoints (thread_id, workflow_type, checkpoint_ns, checkpoint_data, created_at, updated_at)
      VALUES ($1, $2, 'latest', $3, NOW(), NOW())
      ON CONFLICT (thread_id, checkpoint_ns)
      DO UPDATE SET workflow_type = EXCLUDED.workflow_type, checkpoint_data = EXCLUDED.checkpoint_data, updated_at = NOW()`;
    await this.db.query(query, [threadID, wfType, data]);
  }
  // ListWorkflows returns the most recent checkpoint for workflows - matches Go models/workflow_listing.go
  async listWorkflows(limit: number): Promise<WorkflowStatus[]> {
    const query = `SELECT thread_id, workflow_type, checkpoint_data
      FROM workflow_checkpoints
      WHERE checkpoint_ns = 'latest'
      ORDER BY updated_at DESC
      LIMIT $1`;
    const args = [limit];
    const result = await this.db.query<{
      thread_id: string;
      workflow_type: string;
      checkpoint_data: unknown;
    }>(query, args);
    const seen = new Set<string>();
    const results: WorkflowStatus[] = [];
    for (const row of result.rows) {
      const threadID = row.thread_id;
      const wfType = row.workflow_type;
      const data: unknown = row.checkpoint_data;
      if (seen.has(threadID)) {
        continue; // already took latest row for this thread
      }
      seen.add(threadID);
      let participants: string[] = [];
      let currentStep = '';
      try {
        const isRecord = (v: unknown): v is Record<string, unknown> =>
          typeof v === 'object' && v !== null;
        if (isRecord(data) && isRecord((data as { state?: unknown }).state)) {
          const state = (data as { state?: Record<string, unknown> }).state!;
          const maybeParticipants = state.participants;
          if (Array.isArray(maybeParticipants)) {
            participants = maybeParticipants.filter(
              (p: unknown): p is string => typeof p === 'string',
            );
          }
          const maybeCurrent = (state).currentStep;
          if (maybeCurrent !== undefined) {
            currentStep = String(maybeCurrent);
          }
        }
      } catch (e) {
        await errorLog(
          `[CHECKPOINT] listWorkflows, error: ${e instanceof Error ? e.message : String(e)}`,
        );
        // skip malformed rows but continue processing others
        continue;
      }
      results.push({
        thread_id: threadID,
        workflow_type: wfType,
        current_step: currentStep,
        participants: participants,
      });
    }
    return results;
  }
}
