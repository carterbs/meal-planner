/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { v4 as uuidv4 } from 'uuid';
import type { ExtendedRunnableConfig } from './types';
import type { WorkflowStatus } from '@mealplanner/generated/api_pb';
// Generated protobuf types
import type {
  AgentCheckpoint as AgentCheckpointType,
  AgentCheckpointMetadata as AgentCheckpointMetadataType,
} from '@mealplanner/generated/api_pb';
import {
  AgentCheckpoint,
  AgentCheckpointMetadata,
} from '@mealplanner/generated/api_pb';
import type { JsonValue } from '@bufbuild/protobuf';
import { infoLog } from '../logging';
import { CheckpointRepository } from '../database/checkpoints';
export class DbCheckpointSaver {
  private checkpointRepo: CheckpointRepository;
  constructor() {
    this.checkpointRepo = new CheckpointRepository();
  }
  async getTuple(
    config: ExtendedRunnableConfig,
  ): Promise<[AgentCheckpointType, AgentCheckpointMetadataType] | undefined> {
    const threadId = config.configurable?.threadId;
    const checkpointNs = config.configurable?.checkpoint_ns;
    if (!threadId) {
      throw new Error('Thread ID is required for getTuple');
    }
    try {
      const result = await this.checkpointRepo.getCheckpoint(
        threadId,
        checkpointNs ?? 'latest',
      );
      if (!result.found || !result.checkpoint) return undefined;
      // Deserialize the checkpoint and metadata from Buffer to protobuf objects
      const checkpointData = JSON.parse(result.checkpoint.toString()) as unknown as JsonValue;
      const metadataData = (result.metadata
        ? JSON.parse(result.metadata.toString())
        : {}) as unknown as JsonValue;
      // Use the generated fromJson helper so that google.protobuf.Timestamp and other
      // well-known types are deserialized properly (e.g. createdAt / updatedAt).
      const checkpoint = AgentCheckpoint.fromJson(checkpointData);
      const metadata = AgentCheckpointMetadata.fromJson(metadataData);
      await infoLog(
        `[CHECKPOINT] Got checkpoint for thread ${threadId}: ${JSON.stringify(checkpoint)}`,
      );
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
      if (checkpoint.state && typeof checkpoint.state.currentStep !== 'undefined') {
        await infoLog(
          `debugyyz: [CHECKPOINT] CurrentStep: ${String(checkpoint.state.currentStep)}`,
        );
      }
      // Pass strongly typed objects to the database layer for serialization
      await this.checkpointRepo.putCheckpoint(
        threadId,
        checkpointNs,
        'meal_planning',
        checkpoint,
        metadata,
      );
      // Also keep a copy under the reserved namespace "latest" so that
      // resume/list endpoints can easily fetch the most-recent checkpoint
      // without needing the caller to supply a namespace.
      await this.checkpointRepo.updateWorkflowCheckpoint(
        threadId,
        checkpoint,
      );
      return {
        configurable: {
          threadId,
          checkpoint_ns: checkpointNs,
        },
      } as ExtendedRunnableConfig;
    } catch (e) {
      await infoLog(`[CHECKPOINT] Save failed: ${String(e)}`);
      const items = checkpoint.state?.mealPlan?.items ?? [];
      for (const item of items) {
        if (item.mealSnapshot) {
          await infoLog(
            `[CHECKPOINT] lastPlanned: ${String(item.mealSnapshot.lastPlanned)}`,
          );
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
    const records = await this.checkpointRepo.listCheckpoints(limit ?? 100, '');
    for (const record of records) {
      try {
        const checkpointJson = JSON.parse(record.checkpoint_data.toString()) as unknown as JsonValue;
        const metadataJson = JSON.parse(record.metadata.toString()) as unknown as JsonValue;
        const checkpoint = AgentCheckpoint.fromJson(checkpointJson);
        const metadata = AgentCheckpointMetadata.fromJson(metadataJson);
        yield [
          {
            configurable: {
              threadId: record.thread_id,
              checkpoint_ns: record.checkpoint_ns,
            },
          } as ExtendedRunnableConfig,
          checkpoint,
          metadata,
        ];
      } catch (e) {
        await infoLog(
          `[CHECKPOINT] Failed to parse checkpoint for thread ${record.thread_id}: ${String(e)}`,
        );
        continue;
      }
    }
  }
  // Returns the unwrapped WorkflowStatus object for convenience
  async getWorkflowStatus(threadId: string): Promise<WorkflowStatus | null> {
    try {
      const workflows = await this.listWorkflows();
      const workflow = workflows.find((w) => w.threadId === threadId);
      if (workflow) {
        await infoLog(
          `[CHECKPOINT] Got workflow status for thread ${threadId}: ${JSON.stringify(workflow)}`,
        );
        return workflow;
      }
      return null;
    } catch (e) {
      await infoLog(
        `[CHECKPOINT] Workflow status request failed for thread ${threadId}: ${String(e)}`,
      );
      return null;
    }
  }
  async listWorkflows(): Promise<WorkflowStatus[]> {
    try {
      const workflowStatuses = await this.checkpointRepo.listWorkflows(10);
      // Convert database WorkflowStatus to protobuf WorkflowStatus
      return workflowStatuses.map(
        (status) =>
          ({
            threadId: status.thread_id,
            workflowType: status.workflow_type,
            currentStep: status.current_step,
            participants: status.participants,
          }) as WorkflowStatus,
      );
    } catch (e) {
      await infoLog(`[CHECKPOINT] listWorkflows failed: ${String(e)}`);
      return [];
    }
  }
}
