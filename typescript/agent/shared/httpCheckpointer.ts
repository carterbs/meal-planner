import { v4 as uuidv4 } from 'uuid';
import { RunnableConfig } from '@langchain/core/runnables';

// Import from package like UI does
import type {
  AgentCheckpoint as AgentCheckpointType,
  AgentCheckpointMetadata as AgentCheckpointMetadataType
} from '@mealplanner/generated';
import { AgentCheckpoint, AgentCheckpointMetadata } from '@mealplanner/generated';
import { infoLog } from '../logging';

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

    // Convert JSON payload to generated protobuf types so field names use camelCase
    const checkpoint = AgentCheckpoint.fromJSON(data.tuple.checkpoint);
    infoLog(`[CHECKPOINT] Got checkpoint for thread ${threadId}: ${JSON.stringify(checkpoint)}`);
    const metadataRaw = data.tuple.metadata;
    const metadata = metadataRaw ? AgentCheckpointMetadata.fromJSON(metadataRaw) : AgentCheckpointMetadata.create({});
    return [checkpoint, metadata];
  }

  async put(config: RunnableConfig, checkpoint: AgentCheckpointType, metadata: AgentCheckpointMetadataType): Promise<RunnableConfig> {
    const threadId = (config as any).configurable?.threadId || uuidv4();
    const checkpointNs = (config as any).configurable?.checkpoint_ns || uuidv4();

    // Convert protobuf types to JSON for API
    try {
      // log checkpoint
      infoLog(`[CHECKPOINT] Saving checkpoint for thread ${threadId}: ${JSON.stringify(checkpoint)}`);
      const resp = await fetch(`${this.baseUrl}/api/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_id: threadId,
          checkpoint_ns: checkpointNs,
          workflow_type: 'meal_planning',
          checkpoint,
          metadata,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        infoLog(`[CHECKPOINT] Save failed: ${errText}`);
        throw new Error(`Failed to save checkpoint: ${resp.statusText}`);
      }
      return { configurable: { ...(config as any).configurable, threadId, checkpoint_ns: checkpointNs } } as RunnableConfig;
    } catch (e) {
      infoLog(`[CHECKPOINT] Save failed: ${e}`);
      // log checkpoint lastPlanned
      if (checkpoint) {
        for (const day of checkpoint.state?.mealPlan?.days || []) {
          if (day.meal) {
            infoLog(`[CHECKPOINT] lastPlanned: ${day.meal.lastPlanned}`);
          }
        }
      }
      throw e;
    }

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

    // Attempt to parse JSON **only** if the response is OK (2xx). In error cases
    // the backend may respond with a plain-text error, which would otherwise
    // cause a JSON.parse failure and mask the real problem.
    if (!resp.ok) {
      const text = await resp.text();
      infoLog(
        `[CHECKPOINT] Workflow status request failed for thread ${threadId}: ${resp.status} – ${text}`,
      );
      return null;
    }

    const json = await resp.json();
    infoLog(
      `[CHECKPOINT] Got workflow status for thread ${threadId}: ${JSON.stringify(
        json,
      )}`,
    );
    return json;
  }

  async listWorkflows(limit?: number): Promise<any[]> {
    const resp = await fetch(`${this.baseUrl}/api/agent/workflows?limit=${limit || 100}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.workflows || [];
  }
}
