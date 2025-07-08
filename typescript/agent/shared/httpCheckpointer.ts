import { v4 as uuidv4 } from 'uuid';
import { RunnableConfig } from '@langchain/core/runnables';
import { AgentCheckpoint, AgentCheckpointMetadata } from '../../../generated/ts/api';

export class HttpCheckpointSaver {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8090') {
    this.baseUrl = baseUrl;
  }

  async getTuple(config: RunnableConfig): Promise<[AgentCheckpoint, AgentCheckpointMetadata] | undefined> {
    const threadId = (config as any).configurable?.threadId;
    const checkpointNs = (config as any).configurable?.checkpoint_ns;
    if (!threadId) return undefined;
    const url = `${this.baseUrl}/api/checkpoints/${threadId}${checkpointNs ? `?checkpoint_ns=${checkpointNs}` : ''}`;
    const resp = await fetch(url);
    if (!resp.ok) return undefined;
    const data = await resp.json();
    return data.found ? [data.tuple.checkpoint, data.tuple.metadata] : undefined;
  }

  async put(config: RunnableConfig, checkpoint: AgentCheckpoint, metadata: AgentCheckpointMetadata): Promise<RunnableConfig> {
    const threadId = (config as any).configurable?.threadId || uuidv4();
    const checkpointNs = (config as any).configurable?.checkpoint_ns || uuidv4();
    const resp = await fetch(`${this.baseUrl}/api/checkpoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        workflow_type: (metadata as any).workflow_type || 'meal_planning',
        checkpoint,
        metadata,
      }),
    });
    if (!resp.ok) throw new Error(`Failed to save checkpoint: ${resp.statusText}`);
    return { configurable: { ...(config as any).configurable, threadId, checkpoint_ns: checkpointNs } } as RunnableConfig;
  }

  async *list(config: RunnableConfig, limit?: number): AsyncGenerator<[RunnableConfig, AgentCheckpoint, AgentCheckpointMetadata]> {
    const resp = await fetch(`${this.baseUrl}/api/checkpoints?limit=${limit || 100}`);
    if (!resp.ok) return;
    const data = await resp.json();
    for (const entry of data.entries) {
      yield [{ configurable: { threadId: entry.thread_id, checkpoint_ns: entry.checkpoint_ns } } as RunnableConfig, entry.tuple.checkpoint, entry.tuple.metadata];
    }
  }
}
