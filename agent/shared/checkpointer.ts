import { Pool, PoolClient } from 'pg';
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
  private pool: Pool;
  private client: PoolClient | null = null;

  constructor(config: PostgresCheckpointConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection could not be established
    });

    // Log pool events for debugging
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  private async getClient(): Promise<PoolClient> {
    if (!this.client) {
      this.client = await this.pool.connect();
      // Set up error handler for the client
      this.client.on('error', (err) => {
        console.error('Error on client:', err);
        this.client = null; // Force a new connection on next request
      });
    }
    return this.client;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.release();
      this.client = null;
    }
    await this.pool.end();
  }

  parseMaybeJSON(val: any) {
    if (typeof val === 'string') {
      return JSON.parse(val);
    }
    return val;
  }

  async getTuple(config: RunnableConfig): Promise<[SimpleCheckpoint, SimpleCheckpointMetadata] | undefined> {
    const client = await this.getClient();
    try {
      const threadId = config.configurable?.threadId;
      const checkpointNs = config.configurable?.checkpoint_ns; // renamed to match DB column
      
      if (!threadId || !checkpointNs) {
        return undefined;
      }
      
      const result = await client.query(
        'SELECT checkpoint_data, metadata FROM workflow_checkpoints WHERE thread_id = $1 AND checkpoint_ns = $2',
        [threadId, checkpointNs]
      );
      
      if (result.rows.length === 0) {
        return undefined;
      }
      
      const row = result.rows[0];
      const checkpoint = this.parseMaybeJSON(row.checkpoint_data) as SimpleCheckpoint;
      
      // Ensure we return a valid SimpleCheckpointMetadata object with all required properties
      const meta = row.metadata 
        ? this.parseMaybeJSON(row.metadata) 
        : { source: 'workflow_checkpoints', step: 0, writes: {} };
        
      // Ensure all required properties are present
      const fullMeta: SimpleCheckpointMetadata = {
        source: meta.source || 'workflow_checkpoints',
        step: meta.step || 0,
        writes: meta.writes || {}
      };
      
      return [checkpoint, fullMeta];
    } catch (error) {
      console.error('Error getting tuple:', error);
      throw error;
    }
  }

  async *list(
    _config: RunnableConfig,
    limit?: number,
    _before?: RunnableConfig
  ): AsyncGenerator<[RunnableConfig, SimpleCheckpoint, SimpleCheckpointMetadata]> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `SELECT 
          threadId, 
          checkpoint_ns, 
          checkpoint_data, 
          metadata 
        FROM workflow_checkpoints 
        ORDER BY updated_at DESC 
        LIMIT $1`,
        [limit || 100]
      );
      
      for (const row of result.rows) {
        yield [
          { 
            configurable: { 
              threadId: row.threadId, 
              checkpoint_ns: row.checkpoint_ns 
            } 
          },
          this.parseMaybeJSON(row.checkpoint_data) as SimpleCheckpoint,
          row.metadata ? this.parseMaybeJSON(row.metadata) as SimpleCheckpointMetadata : {
            source: 'workflow_checkpoints',
            step: 0,
            writes: {}
          }
        ];
      }
    } catch (error) {
      console.error('Error listing checkpoints:', error);
      throw error;
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: SimpleCheckpoint,
    metadata: SimpleCheckpointMetadata
  ): Promise<RunnableConfig> {
    const client = await this.getClient();
    try {
      const threadId = config.configurable?.threadId || uuidv4();
      const checkpointNs = config.configurable?.checkpoint_ns || uuidv4();
      const workflowType = metadata.workflow_type || checkpoint.channel_values?.workflow_type || WorkflowType.MEAL_PLANNING;

      await client.query(
        `INSERT INTO workflow_checkpoints 
         (thread_id, checkpoint_ns, workflow_type, checkpoint_data, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (thread_id, checkpoint_ns) 
         DO UPDATE SET 
           workflow_type = EXCLUDED.workflow_type,
           checkpoint_data = EXCLUDED.checkpoint_data,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()
        `,
        [
          threadId,
          checkpointNs,
          workflowType,
          JSON.stringify(checkpoint),
          JSON.stringify(metadata)
        ]
      );
      
      return { 
        configurable: { 
          ...config.configurable, 
          threadId: threadId,
          checkpoint_ns: checkpointNs 
        } 
      };
    } catch (error) {
      console.error('Error saving checkpoint:', error);
      throw error;
    }
  }

  async putWrites(
    _config: RunnableConfig,
    writes: Array<[string, any]>,
    taskId: string
  ): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      for (const [key, value] of writes) {
        await client.query(
          'INSERT INTO writes (task_id, key, value) VALUES ($1, $2, $3) ON CONFLICT (task_id, key) DO UPDATE SET value = EXCLUDED.value',
          [taskId, key, JSON.stringify(value)]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error writing to database:', error);
      throw error;
    }
  }

  // Utility methods for workflow management
  async listWorkflows(workflowType?: WorkflowType): Promise<Array<{
    threadId: string;
    workflow_type: WorkflowType;
    created_at: Date;
    updated_at: Date;
  }>> {
    const client = await this.getClient();
    try {
      let query = 'SELECT DISTINCT ON (thread_id) thread_id, workflow_type, created_at, updated_at FROM workflow_checkpoints ORDER BY thread_id, updated_at DESC';
      const params: any[] = [];
      
      if (workflowType) {
        query += ' WHERE workflow_type = $1';
        params.push(workflowType);
      }
      
      const result = await client.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error listing workflows:', error);
      throw error;
    }
  }

  async deleteWorkflow(threadId: string): Promise<boolean> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        'DELETE FROM workflow_checkpoints WHERE thread_id = $1 RETURNING thread_id',
        [threadId]
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting workflow:', error);
      throw error;
    }
  }

  async getWorkflowStatus(threadId: string): Promise<{
    workflow_type: WorkflowType;
    current_step: string;
    created_at: Date;
    updated_at: Date;
  } | null> {
    const client = await this.pool.connect(); // Acquire client directly from the pool
    try {
      const result = await client.query(
        'SELECT workflow_type, checkpoint_data, created_at, updated_at FROM workflow_checkpoints WHERE thread_id = $1',
        [threadId]
      );
      if (result.rows.length === 0) {
        return null;
      }
      const row = result.rows[0];
      const checkpointData = this.parseMaybeJSON(row.checkpoint_data);
      // Ensure current_step is correctly accessed
      const currentStep = checkpointData?.channel_values?.current_step || 'unknown';

      return {
        workflow_type: row.workflow_type,
        current_step: currentStep,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    } catch (error) {
      console.error('Error getting workflow status:', error);
      throw error;
    } finally {
      client.release(); // Always release the client
    }
  }
}