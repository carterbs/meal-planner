import { infoLog } from './logging';
import { WorkflowType } from './shared/types';
import { HttpCheckpointSaver } from './shared/httpCheckpointer';
import type { ExtendedRunnableConfig } from './shared/types';

// Workflow graph interface
export interface WorkflowGraph<I = unknown, O = unknown> {
  invoke(input: I, config: ExtendedRunnableConfig): Promise<O>;
}

// Base workflow interface
export interface BaseWorkflow<I = unknown, O = unknown> {
  readonly type: WorkflowType;
  readonly graph: WorkflowGraph<I, O>;
  initialize(): Promise<void>;
  cleanup?(): Promise<void>;
}

// Workflow factory interface
export interface WorkflowFactory<I = unknown, O = unknown> {
  create(checkpointer: HttpCheckpointSaver): Promise<BaseWorkflow<I, O>>;
  getType(): WorkflowType;
}

// Registry to manage all workflow types
export class WorkflowRegistry {
  private factories = new Map<WorkflowType, WorkflowFactory>();
  private instances = new Map<string, BaseWorkflow>();

  registerFactory(factory: WorkflowFactory): void {
    this.factories.set(factory.getType(), factory);
  }

  async createWorkflow(
    type: WorkflowType,
    checkpointer: HttpCheckpointSaver,
  ): Promise<BaseWorkflow> {
    infoLog(`Creating workflow of type: ${type}`);
    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(`No factory registered for workflow type: ${type}`);
    }

    const workflow = await factory.create(checkpointer);
    await workflow.initialize();

    return workflow;
  }

  async getOrCreateWorkflow(
    type: WorkflowType,
    threadId: string,
    checkpointer: HttpCheckpointSaver,
  ): Promise<BaseWorkflow> {
    const key = `${type}:${threadId}`;

    if (this.instances.has(key)) {
      return this.instances.get(key)!;
    }

    const workflow = await this.createWorkflow(type, checkpointer);
    this.instances.set(key, workflow);

    return workflow;
  }

  async cleanupWorkflow(type: WorkflowType, threadId: string): Promise<void> {
    const key = `${type}:${threadId}`;
    const workflow = this.instances.get(key);

    if (workflow && workflow.cleanup) {
      await workflow.cleanup();
    }

    this.instances.delete(key);
  }

  async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.instances.entries()).map(
      async ([, workflow]) => {
        if (workflow.cleanup) {
          await workflow.cleanup();
        }
      },
    );

    await Promise.all(cleanupPromises);
    this.instances.clear();
  }

  getSupportedTypes(): WorkflowType[] {
    return Array.from(this.factories.keys());
  }

  isTypeSupported(type: WorkflowType): boolean {
    return this.factories.has(type);
  }
}

// Singleton registry instance
export const workflowRegistry = new WorkflowRegistry();
