import { v4 as uuidv4 } from 'uuid';
import type { ExtendedRunnableConfig } from './types';
import type { WorkflowStatus } from '@mealplanner/generated/api_pb';
import { createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { MealPlannerAPI } from '@mealplanner/generated/api_connect';
// Generated protobuf types
import type {
  AgentCheckpoint as AgentCheckpointType,
  AgentCheckpointMetadata as AgentCheckpointMetadataType,
} from '@mealplanner/generated/api_pb';
import {
  AgentCheckpoint,
  AgentCheckpointMetadata,
} from '@mealplanner/generated/api_pb';
import { infoLog } from '../logging';
export class HttpCheckpointSaver {
  private baseUrl: string;
  private client: ReturnType<typeof createClient<typeof MealPlannerAPI>>;
  constructor(
    baseUrl: string = process.env.BACKEND_GRPC_URL || 'http://localhost:50051',
  ) {
    this.baseUrl = baseUrl;
    const transport = createGrpcTransport({
      baseUrl: this.baseUrl,
      httpVersion: '2',
    });
    this.client = createClient(MealPlannerAPI, transport);
  }
  async getTuple(
    config: ExtendedRunnableConfig,
  ): Promise<[AgentCheckpointType, AgentCheckpointMetadataType] | undefined> {
    const threadId = config.configurable?.threadId;
    const checkpointNs = config.configurable?.checkpoint_ns;
    if (!threadId) return undefined;
    try {
      const response = await this.client.getCheckpoint({
        threadId,
        checkpointNs: checkpointNs ?? '',
      });
      if (!response.found || !response.tuple) return undefined;
      const checkpoint = response.tuple.checkpoint ?? new AgentCheckpoint();
      await infoLog(
        `[CHECKPOINT] Got checkpoint for thread ${threadId}: ${JSON.stringify(checkpoint)}`,
      );
      const metadata = response.tuple.metadata ?? new AgentCheckpointMetadata();
      return [checkpoint, metadata];
    } catch (e) {
      await infoLog(`[CHECKPOINT] getTuple failed: ${String(e)}`);
      return undefined;
    }
  }
  async put(
    config: ExtendedRunnableConfig,
    checkpoint: AgentCheckpointType,
    metadata: AgentCheckpointMetadataType,
  ): Promise<ExtendedRunnableConfig> {
    const threadId = config.configurable?.threadId ?? uuidv4();
    const checkpointNs = config.configurable?.checkpoint_ns ?? uuidv4();
    try {
      await infoLog(
        `debugyyz: [CHECKPOINT] Saving checkpoint for thread ${threadId}: ${JSON.stringify(checkpoint)}`,
      );
      await infoLog(
        `debugyyz: [CHECKPOINT] CurrentStep: ${checkpoint.state?.currentStep}`,
      );
      try {
        await this.client.putCheckpoint({
          threadId,
          checkpointNs,
          workflowType: 'meal_planning',
          checkpoint,
          metadata,
        });
      } catch (e) {
        await infoLog(`[CHECKPOINT] putCheckpoint failed (non-fatal): ${String(e)}`);
        // swallow the error so workflows continue even when persistence isn't available
      }
      return {
        configurable: {
          threadId,
          checkpoint_ns: checkpointNs,
        },
      } as ExtendedRunnableConfig;
    } catch (e) {
      await infoLog(`[CHECKPOINT] Save failed: ${String(e)}`);
      for (const day of (checkpoint.state?.mealPlan?.days ?? [])) {
        if (day.meal) {
          await infoLog(`[CHECKPOINT] lastPlanned: ${String(day.meal.lastPlanned)}`);
        }
      }
      throw e;
    }
  }
  async *list(
    _config: ExtendedRunnableConfig,
    limit?: number,
  ): AsyncGenerator<
    [ExtendedRunnableConfig, AgentCheckpointType, AgentCheckpointMetadataType]
  > {
    const response = await this.client.listCheckpoints({
      limit: limit ?? 100,
    });
    for (const entry of response.entries) {
      const checkpoint = entry.tuple?.checkpoint ?? new AgentCheckpoint();
      const metadata = entry.tuple?.metadata ?? new AgentCheckpointMetadata();
      yield [
        {
          configurable: {
            threadId: entry.threadId,
            checkpoint_ns: entry.checkpointNs,
          },
        } as ExtendedRunnableConfig,
        checkpoint,
        metadata,
      ];
    }
  }
  // Returns the unwrapped WorkflowStatus object for convenience
  async getWorkflowStatus(threadId: string): Promise<WorkflowStatus | null> {
    try {
      const resp = await this.client.getWorkflowStatus({ threadId });
      const status = resp.status ?? null;
      await infoLog(
        `[CHECKPOINT] Got workflow status for thread ${threadId}: ${JSON.stringify(status)}`,
      );
      return status;
    } catch (e) {
      await infoLog(
        `[CHECKPOINT] Workflow status request failed for thread ${threadId}: ${String(e)}`,
      );
      return null;
    }
  }
  async listWorkflows(): Promise<WorkflowStatus[]> {
    const resp = await this.client.listWorkflows({});
    return resp.workflows;
  }
}
