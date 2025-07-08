import { v4 as uuidv4 } from 'uuid';
import { RunnableConfig } from '@langchain/core/runnables';

// Import from package like UI does
import type { 
  AgentCheckpoint as AgentCheckpointType, 
  AgentCheckpointMetadata as AgentCheckpointMetadataType 
} from '@mealplanner/generated';
import { AgentCheckpoint, AgentCheckpointMetadata } from '@mealplanner/generated';

export class HttpCheckpointSaver {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8090') {
    this.baseUrl = baseUrl;
  }

  async getTuple(config: RunnableConfig): Promise<[AgentCheckpointType, AgentCheckpointMetadataType] | undefined> {
    const threadId = (config as any).configurable?.threadId;
    const checkpointNs = (config as any).configurable?.checkpoint_ns;
    if (!threadId) return undefined;
    const url = `${this.baseUrl}/api/checkpoints/${threadId}${checkpointNs ? `?checkpoint_ns=${checkpointNs}` : ''}`;
    const resp = await fetch(url);
    if (!resp.ok) return undefined;
    const data = await resp.json();
    if (!data.found) return undefined;
    
    // Convert from JSON to protobuf types
    const checkpoint = AgentCheckpoint.fromJSON(data.tuple.checkpoint);
    const metadata = AgentCheckpointMetadata.fromJSON(data.tuple.metadata);
    return [checkpoint, metadata];
  }

  async put(config: RunnableConfig, checkpoint: AgentCheckpointType, metadata: AgentCheckpointMetadataType): Promise<RunnableConfig> {
    const threadId = (config as any).configurable?.threadId || uuidv4();
    const checkpointNs = (config as any).configurable?.checkpoint_ns || uuidv4();
    
    // Convert protobuf types to JSON for API
    const checkpointJson = AgentCheckpoint.toJSON(checkpoint);
    const metadataJson = AgentCheckpointMetadata.toJSON(metadata);
    
    const resp = await fetch(`${this.baseUrl}/api/checkpoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        workflow_type: (metadataJson as any).workflow_type || 'meal_planning',
        checkpoint: checkpointJson,
        metadata: metadataJson,
      }),
    });
    if (!resp.ok) throw new Error(`Failed to save checkpoint: ${resp.statusText}`);
    return { configurable: { ...(config as any).configurable, threadId, checkpoint_ns: checkpointNs } } as RunnableConfig;
  }

  async *list(_config: RunnableConfig, limit?: number): AsyncGenerator<[RunnableConfig, AgentCheckpointType, AgentCheckpointMetadataType]> {
    const resp = await fetch(`${this.baseUrl}/api/checkpoints?limit=${limit || 100}`);
    if (!resp.ok) return;
    const data = await resp.json();
    for (const entry of data.entries) {
      // Convert from JSON to protobuf types
      const checkpoint = AgentCheckpoint.fromJSON(entry.tuple.checkpoint);
      const metadata = AgentCheckpointMetadata.fromJSON(entry.tuple.metadata);
      yield [{ configurable: { threadId: entry.thread_id, checkpoint_ns: entry.checkpoint_ns } } as RunnableConfig, checkpoint, metadata];
    }
  }

  async getWorkflowStatus(threadId: string): Promise<any> {
    const resp = await fetch(`${this.baseUrl}/api/workflows/${threadId}`);
    if (!resp.ok) return null;
    return await resp.json();
  }

  async listWorkflows(limit?: number): Promise<any[]> {
    const resp = await fetch(`${this.baseUrl}/api/workflows?limit=${limit || 100}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.workflows || [];
  }
}
