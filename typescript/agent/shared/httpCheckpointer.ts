import { v4 as uuidv4 } from 'uuid';
import { RunnableConfig } from '@langchain/core/runnables';

import { createClient } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-node';
import { MealPlannerAPI } from '@mealplanner/generated/api_connect';

// Generated protobuf types
import type {
  AgentCheckpoint as AgentCheckpointType,
  AgentCheckpointMetadata as AgentCheckpointMetadataType,
} from '@mealplanner/generated/api_pb';

import { AgentCheckpoint, AgentCheckpointMetadata } from '@mealplanner/generated/api_pb'; 
import { infoLog } from '../logging';

export class HttpCheckpointSaver {
  private baseUrl: string;
  private client: ReturnType<typeof createClient<typeof MealPlannerAPI>>;

  constructor(baseUrl: string = 'http://localhost:8080') {
    this.baseUrl = baseUrl;

    const transport = createConnectTransport({
      baseUrl: this.baseUrl,
      httpVersion: '1.1',
    });
    this.client = createClient(MealPlannerAPI, transport);
  }

  async getTuple(
    config: RunnableConfig,
  ): Promise<[AgentCheckpointType, AgentCheckpointMetadataType] | undefined> {
    const threadId = (config as any).configurable?.threadId;
    const checkpointNs = (config as any).configurable?.checkpoint_ns;
    if (!threadId) return undefined;

    try {
      const response = (await this.client.getCheckpoint({
        threadId,
        checkpointNs: checkpointNs ?? '',
      }));

      if (!response.found || !response.tuple) return undefined;

      const checkpoint = response.tuple.checkpoint ?? new AgentCheckpoint();
      infoLog(
        `[CHECKPOINT] Got checkpoint for thread ${threadId}: ${JSON.stringify(
          checkpoint,
        )}`,
      );
      const metadata =
        response.tuple.metadata ?? new AgentCheckpointMetadata();
      return [checkpoint, metadata];
    } catch (e) {
      infoLog(`[CHECKPOINT] getTuple failed: ${e}`);
      return undefined;
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: AgentCheckpointType,
    metadata: AgentCheckpointMetadataType,
  ): Promise<RunnableConfig> {
    const threadId = (config as any).configurable?.threadId || uuidv4();
    const checkpointNs = (config as any).configurable?.checkpoint_ns || uuidv4();

    try {
      infoLog(
        `[CHECKPOINT] Saving checkpoint for thread ${threadId}: ${JSON.stringify(
          checkpoint,
        )}`,
      );
      await this.client.putCheckpoint({
        threadId,
        checkpointNs,
        workflowType: 'meal_planning',
        checkpoint,
        metadata,
      });
      return {
        configurable: {
          ...config.configurable,
          threadId,
          checkpoint_ns: checkpointNs,
        },
      } as RunnableConfig;
    } catch (e) {
      infoLog(`[CHECKPOINT] Save failed: ${e}`);
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

  async *list(
    _config: RunnableConfig,
    limit?: number,
  ): AsyncGenerator<
    [RunnableConfig, AgentCheckpointType, AgentCheckpointMetadataType]
  > {
    const response = (await this.client.listCheckpoints({
      limit: limit ?? 100,
    }));

    for (const entry of response.entries) {
      const checkpoint =
        entry.tuple?.checkpoint ?? new AgentCheckpoint();
      const metadata =
        entry.tuple?.metadata ?? new AgentCheckpointMetadata();
      yield [
        {
          configurable: {
            threadId: entry.threadId,
            checkpoint_ns: entry.checkpointNs,
          },
        } as RunnableConfig,
        checkpoint,
        metadata,
      ];
    }
  }

  async getWorkflowStatus(threadId: string): Promise<any> {
    try {
      const resp = await this.client.getWorkflowStatus({ threadId });
      infoLog(
        `[CHECKPOINT] Got workflow status for thread ${threadId}: ${JSON.stringify(
          resp,
        )}`,
      );
      return resp;
    } catch (e) {
      infoLog(
        `[CHECKPOINT] Workflow status request failed for thread ${threadId}: ${e}`,
      );
      return null;
    }
  }

  async listWorkflows(): Promise<any[]> {
    const resp = await this.client.listWorkflows({});
    return resp.workflows || [];
  }
}
