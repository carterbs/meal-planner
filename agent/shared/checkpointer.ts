import { Client as PgClient } from 'pg';
import { RunnableConfig } from '@langchain/core/runnables';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowType } from './types.js';

export interface PostgresCheckpointConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

// Simplified checkpoint interface to avoid LangGraph version compatibility issues
export interface SimpleCheckpoint {
  channel_values: Record<string, any>;
  next: string[];
  step: number;
}

export interface SimpleCheckpointMetadata {
  source: string;
  step: number;
  writes: Record<string, any>;
  [key: string]: any;
}

export class PostgresCheckpointSaver {
  private client: PgClient;
  private isConnected: boolean = false;

  constructor(config: PostgresCheckpointConfig) {
    this.client = new PgClient(config);
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
      this.isConnected = true;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.end();
      this.isConnected = false;
    }
  }

  parseMaybeJSON(val: any) {
    if (typeof val === 'string') {
      return JSON.parse(val);
    }
    return val;
  }

  async getTuple(config: RunnableConfig): Promise<[SimpleCheckpoint, SimpleCheckpointMetadata] | undefined> {
    await this.connect();
    const { configurable } = config;
    if (!configurable?.thread_id) {
      return undefined;
    }
    const result = await this.client.query(
      'SELECT checkpoint_data, metadata FROM workflow_checkpoints WHERE thread_id = $1 ORDER BY updated_at DESC LIMIT 1',
      [configurable.thread_id]
    );
    if (result.rows.length === 0) {
      return undefined;
    }
    const row = result.rows[0];
    const checkpoint = this.parseMaybeJSON(row.checkpoint_data);
    const meta = row.metadata ? this.parseMaybeJSON(row.metadata) : {};
    return [checkpoint, meta];
  }

  async *list(
    config: RunnableConfig,
    limit?: number,
    before?: RunnableConfig
  ): AsyncGenerator<[RunnableConfig, SimpleCheckpoint, SimpleCheckpointMetadata]> {
    await this.connect();

    const { configurable } = config;
    if (!configurable?.thread_id) {
      return;
    }

    let query = 'SELECT thread_id, checkpoint_ns, checkpoint_data, metadata, created_at FROM workflow_checkpoints WHERE thread_id = $1';
    const params: any[] = [configurable.thread_id];

    query += ' ORDER BY updated_at DESC';

    if (limit) {
      query += ` LIMIT ${limit}`;
    }

    const result = await this.client.query(query, params);

    for (const row of result.rows) {
      const checkpointConfig: RunnableConfig = {
        configurable: {
          thread_id: row.thread_id,
          checkpoint_ns: row.checkpoint_ns
        }
      };

      yield [
        checkpointConfig,
        JSON.parse(row.checkpoint_data),
        row.metadata ? JSON.parse(row.metadata) : {}
      ];
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: SimpleCheckpoint,
    metadata: SimpleCheckpointMetadata
  ): Promise<RunnableConfig> {
    await this.connect();

    const { configurable } = config;
    const threadId = configurable?.thread_id || uuidv4();
    const checkpointNs = configurable?.checkpoint_ns || '';
    
    // Extract workflow type from metadata or checkpoint
    const workflowType = metadata.workflow_type || checkpoint.channel_values?.workflow_type || WorkflowType.MEAL_PLANNING;

    await this.client.query(
      `INSERT INTO workflow_checkpoints 
       (thread_id, workflow_type, checkpoint_ns, checkpoint_data, metadata, updated_at) 
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (thread_id) 
       DO UPDATE SET 
         workflow_type = $2,
         checkpoint_ns = $3,
         checkpoint_data = $4,
         metadata = $5,
         updated_at = CURRENT_TIMESTAMP`,
      [
        threadId,
        workflowType,
        checkpointNs,
        JSON.stringify(checkpoint),
        JSON.stringify(metadata)
      ]
    );

    return {
      configurable: {
        ...configurable,
        thread_id: threadId,
        checkpoint_ns: checkpointNs
      }
    };
  }

  async putWrites(
    config: RunnableConfig,
    writes: Array<[string, any]>,
    taskId: string
  ): Promise<void> {
    // For now, we'll store writes as part of the checkpoint data
    // In a more sophisticated implementation, we might have a separate writes table
    console.log(`Storing writes for task ${taskId}:`, writes);
  }

  // Utility methods for workflow management
  async listWorkflows(workflowType?: WorkflowType): Promise<Array<{
    thread_id: string;
    workflow_type: WorkflowType;
    created_at: Date;
    updated_at: Date;
  }>> {
    await this.connect();

    let query = 'SELECT thread_id, workflow_type, created_at, updated_at FROM workflow_checkpoints';
    const params: any[] = [];

    if (workflowType) {
      query += ' WHERE workflow_type = $1';
      params.push(workflowType);
    }

    query += ' ORDER BY updated_at DESC';

    const result = await this.client.query(query, params);
    return result.rows;
  }

  async deleteWorkflow(threadId: string): Promise<boolean> {
    await this.connect();

    const result = await this.client.query(
      'DELETE FROM workflow_checkpoints WHERE thread_id = $1',
      [threadId]
    );

    return result.rowCount !== null && result.rowCount > 0;
  }

  async getWorkflowStatus(threadId: string): Promise<{
    workflow_type: WorkflowType;
    current_step: string;
    created_at: Date;
    updated_at: Date;
  } | null> {
    await this.connect();
    const result = await this.client.query(
      'SELECT workflow_type, checkpoint_data, created_at, updated_at FROM workflow_checkpoints WHERE thread_id = $1',
      [threadId]
    );
    if (result.rows.length === 0) {
      return null;
    }
    const row = result.rows[0];
    const checkpointData = this.parseMaybeJSON(row.checkpoint_data);
    return {
      workflow_type: row.workflow_type,
      current_step: checkpointData.channel_values?.current_step || 'unknown',
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}