import { infoLog, errorLog } from './logging';
import { v4 as uuidv4 } from 'uuid';
import { RunnableConfig } from '@langchain/core/runnables';
import { WorkflowType } from './shared/types';
// Removed PostgreSQL dependencies - using HTTP checkpointer only
import { HttpCheckpointSaver } from './shared/httpCheckpointer';
import { WorkflowRegistry } from './registry';
import { debugLog } from './cli';

export interface WorkflowSession {
  threadId: string;
  workflowType: WorkflowType;
  participants: string[];
  createdAt: Date;
  lastUpdated: Date;
  currentStep: string;
  isActive: boolean;
}

export interface WorkflowExecutionOptions {
  threadId?: string;
  participants?: string[];
  input?: InputPayload;
  maxIterations?: number;
}

// ----------------- Compatibility Types & Aliases -----------------
export type InputPayload = Record<string, unknown>;

interface WorkflowStatusCompat {
  threadId: string;
  workflowType?: WorkflowType;
  workflow_type?: WorkflowType;
  createdAt?: string | number | Date;
  created_at?: string | number | Date;
  updatedAt?: string | number | Date;
  updated_at?: string | number | Date;
  currentStep?: string;
  current_step?: string;
}

interface WorkflowGraphResult {
  currentStep?: string;
  current_step?: string;
  [key: string]: unknown;
}
// ----------------------------------------------------------------

export class WorkflowManager {
  private checkpointer: HttpCheckpointSaver;
  private registry: WorkflowRegistry;
  private activeSessions = new Map<string, WorkflowSession>();

  constructor(registry: WorkflowRegistry) {
    this.checkpointer = new HttpCheckpointSaver();
    this.registry = registry;
  }

  // Public getter for checkpointer
  getCheckpointer(): HttpCheckpointSaver {
    return this.checkpointer;
  }

  async initialize(): Promise<void> {
    await this.loadActiveSessions();
  }

  async shutdown(): Promise<void> {
    await this.registry.cleanupAll();
  }

  // Start a new workflow session
  async startWorkflow(
    type: WorkflowType,
    options: WorkflowExecutionOptions = {},
  ): Promise<string> {
    if (!this.registry.isTypeSupported(type)) {
      throw new Error(`Unsupported workflow type: ${type}`);
    }

    const threadId = options.threadId || uuidv4();
    const participants = options.participants || ['brad'];

    try {
      // Create workflow session
      const session: WorkflowSession = {
        threadId,
        workflowType: type,
        participants,
        createdAt: new Date(),
        lastUpdated: new Date(),
        currentStep: 'initiate',
        isActive: true,
      };

      this.activeSessions.set(threadId, session);

      // Get or create workflow instance
      const workflow = await this.registry.getOrCreateWorkflow(
        type,
        threadId,
        this.checkpointer,
      );

      // Actually invoke the workflow up to feedback pause with timeout
      const workflowPromise = workflow.graph.invoke(
        {},
        {
          configurable: {
            threadId: threadId,
            workflow_type: type,
          },
        },
      );

      // Add 10 second timeout for workflow startup
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Workflow startup timeout')), 30000);
      });

      await Promise.race([workflowPromise, timeoutPromise]);

      infoLog(
        `🚀 [WORKFLOW] Started ${type} workflow with thread ID: ${threadId}`,
      );
      return threadId;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      errorLog(`${`❌ [WORKFLOW] Error starting workflow ${type}:`} ${error}`);
      throw new Error(`Failed to start workflow: ${errorMessage}`);
    }
  }

  // Execute a step in a workflow
  async executeWorkflowStep(
    threadId: string,
    input: InputPayload = {},
  ): Promise<{
    success: boolean;
    message: string;
    currentStep?: string;
    threadId: string;
    [key: string]: unknown;
  }> {
    const session = this.activeSessions.get(threadId);
    if (!session) {
      throw new Error(`No active session found for thread ID: ${threadId}`);
    }

    if (!session.isActive) {
      throw new Error(`Session ${threadId} is not active`);
    }

    const workflow = await this.registry.getOrCreateWorkflow(
      session.workflowType,
      threadId,
      this.checkpointer,
    );

    const config: RunnableConfig = {
      configurable: {
        threadId: threadId,
        workflow_type: session.workflowType,
      },
    };

    try {
      // Execute the workflow step
      const result = await workflow.graph.invoke(input, config);

      const stepResult = result as WorkflowGraphResult;

      // Update session
      session.lastUpdated = new Date();
      session.currentStep =
        stepResult.currentStep ??
        stepResult.current_step ??
        session.currentStep;

      // Check if workflow is complete
      const isComplete =
        (stepResult.currentStep ?? stepResult.current_step) === 'complete';
      if (isComplete) {
        session.isActive = false;
        infoLog(
          `✅ [WORKFLOW] Completed ${session.workflowType} workflow: ${threadId}`,
        );
      }

      // Format the response
      return {
        success: true,
        message: isComplete
          ? 'Workflow completed successfully'
          : 'Workflow step executed successfully',
        currentStep: session.currentStep,
        threadId,
        ...result,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      errorLog(
        `${`❌ [WORKFLOW] Error executing step for ${threadId}:`} ${error}`,
      );

      return {
        success: false,
        message: `Error executing workflow step: ${errorMessage}`,
        currentStep: session.currentStep,
        threadId,
        error: errorMessage,
      };
    }
  }

  // Resume a paused workflow
  async resumeWorkflow(
    threadId: string,
    input: InputPayload = {},
  ): Promise<{
    success: boolean;
    message: string;
    currentStep?: string;
    threadId: string;
    [key: string]: unknown;
  }> {
    try {
      const resumeWorkflowStart = Date.now();
      // Check if session exists in memory
      let session = this.activeSessions.get(threadId);

      // If not in memory, try to load from database
      if (!session) {
        const getWorkflowStatusStart = Date.now();
        const status = await this.checkpointer.getWorkflowStatus(threadId);
        debugLog(
          `[WORKFLOW] getWorkflowStatus took ${Date.now() - getWorkflowStatusStart}ms`,
          { rawStatus: JSON.stringify(status || {}) },
        );
        if (status) {
          const statusCompat = status as WorkflowStatusCompat;
          session = {
            threadId,
            workflowType:
              statusCompat.workflowType ??
              statusCompat.workflow_type ??
              WorkflowType.MEAL_PLANNING,
            participants: ['brad'], // Default participant, could be enhanced
            createdAt: new Date(
              statusCompat.createdAt ?? statusCompat.created_at ?? Date.now(),
            ),
            lastUpdated: new Date(
              statusCompat.updatedAt ?? statusCompat.updated_at ?? Date.now(),
            ),
            currentStep:
              statusCompat.currentStep ??
              statusCompat.current_step ??
              'unknown',
            isActive:
              (statusCompat.currentStep ?? statusCompat.current_step) !==
              'complete',
          };
          this.activeSessions.set(threadId, session);
        }
      }

      if (!session) {
        return {
          success: false,
          message: `No workflow found for thread ID: ${threadId}`,
          threadId,
        };
      }

      if (!session.isActive) {
        return {
          success: false,
          message: `Workflow ${threadId} is already complete`,
          currentStep: session.currentStep,
          threadId,
        };
      }

      infoLog(
        `🔄 [WORKFLOW] Resuming ${session.workflowType} workflow: ${threadId}`,
      );
      const executeWorkflowStepStart = Date.now();
      debugLog('[WORKFLOW] Session state before execute', {
        session: JSON.stringify(session),
      });
      const result = await this.executeWorkflowStep(threadId, input);
      debugLog('[WORKFLOW] resumeWorkflow result', {
        result: JSON.stringify(result),
      });
      const executeWorkflowStepEnd = Date.now();
      debugLog(
        `[WORKFLOW] executeWorkflowStep took ${executeWorkflowStepEnd - executeWorkflowStepStart}ms`,
      );
      debugLog(
        `[WORKFLOW] resumeWorkflow took ${Date.now() - resumeWorkflowStart}ms`,
      );
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      errorLog(
        `${`❌ [WORKFLOW] Error resuming workflow ${threadId}:`} ${error}`,
      );

      return {
        success: false,
        message: `Error resuming workflow: ${errorMessage}`,
        threadId,
        error: errorMessage,
      };
    }
  }

  // Cancel a workflow
  async cancelWorkflow(threadId: string): Promise<boolean> {
    const session = this.activeSessions.get(threadId);
    if (!session) {
      return false;
    }

    session.isActive = false;
    await this.registry.cleanupWorkflow(session.workflowType, threadId);
    this.activeSessions.delete(threadId);

    infoLog(
      `🛑 [WORKFLOW] Cancelled ${session.workflowType} workflow: ${threadId}`,
    );
    return true;
  }

  // Get workflow status
  async getWorkflowStatus(threadId: string): Promise<WorkflowSession | null> {
    // First, check in-memory sessions
    const session = this.activeSessions.get(threadId);
    if (session) {
      return { ...session };
    }

    // Otherwise, query the backend
    const status = await this.checkpointer.getWorkflowStatus(threadId);
    if (!status) {
      return null;
    }

    const statusCompat = status as WorkflowStatusCompat;
    const newSession: WorkflowSession = {
      threadId,
      workflowType:
        statusCompat.workflowType ??
        statusCompat.workflow_type ??
        WorkflowType.MEAL_PLANNING,
      participants: ['brad'], // TODO: Replace with actual participants once supported
      createdAt: new Date(
        statusCompat.createdAt ?? statusCompat.created_at ?? Date.now(),
      ),
      lastUpdated: new Date(
        statusCompat.updatedAt ?? statusCompat.updated_at ?? Date.now(),
      ),
      currentStep:
        statusCompat.currentStep ?? statusCompat.current_step ?? 'unknown',
      isActive:
        (statusCompat.currentStep ?? statusCompat.current_step) !== 'complete',
    };

    this.activeSessions.set(threadId, newSession);
    return newSession;
  }

  /**
   * List all workflows, optionally filtered by type.
   */
  async listWorkflows(type?: WorkflowType): Promise<WorkflowSession[]> {
    const sessions: WorkflowSession[] = [];

    // In-memory sessions first
    for (const s of this.activeSessions.values()) {
      if (!type || s.workflowType === type) {
        sessions.push({ ...s });
      }
    }

    // Query backend for any additional workflows not in memory
    const statuses = await this.checkpointer.listWorkflows();
    for (const status of statuses) {
      if (this.activeSessions.has(status.threadId)) {
        continue; // already included
      }

      const statusCompat = status as WorkflowStatusCompat;
      const workflowType: WorkflowType =
        statusCompat.workflowType ??
        statusCompat.workflow_type ??
        WorkflowType.MEAL_PLANNING;

      if (type && workflowType !== type) {
        continue;
      }

      const isComplete =
        (statusCompat.currentStep ?? statusCompat.current_step) === 'complete';

      const sess: WorkflowSession = {
        threadId: status.threadId,
        workflowType,
        participants: ['brad'],
        createdAt: new Date(
          statusCompat.createdAt ?? statusCompat.created_at ?? Date.now(),
        ),
        lastUpdated: new Date(
          statusCompat.updatedAt ?? statusCompat.updated_at ?? Date.now(),
        ),
        currentStep:
          statusCompat.currentStep ?? statusCompat.current_step ?? 'unknown',
        isActive: !isComplete,
      };
      sessions.push(sess);
    }

    // Most recent first
    return sessions.sort(
      (a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime(),
    );
  }

  /** Get number of active (in-memory) sessions */
  getActiveSessionCount(): number {
    return Array.from(this.activeSessions.values()).filter((s) => s.isActive)
      .length;
  }

  /** Return supported workflow types registered with the registry */
  getSupportedWorkflowTypes(): WorkflowType[] {
    return this.registry.getSupportedTypes();
  }

  /**
   * Load active (non-completed) workflows from backend into memory.
   */
  private async loadActiveSessions(): Promise<void> {
    try {
      const statuses = await this.checkpointer.listWorkflows();
      for (const status of statuses) {
        const statusCompat = status as WorkflowStatusCompat;
        const isComplete =
          (statusCompat.currentStep ?? statusCompat.current_step) ===
          'complete';
        if (isComplete) {
          continue;
        }

        if (this.activeSessions.has(status.threadId)) {
          continue;
        }

        const session: WorkflowSession = {
          threadId: status.threadId,
          workflowType:
            statusCompat.workflowType ??
            statusCompat.workflow_type ??
            WorkflowType.MEAL_PLANNING,
          participants: ['brad'],
          createdAt: new Date(
            statusCompat.createdAt ?? statusCompat.created_at ?? Date.now(),
          ),
          lastUpdated: new Date(
            statusCompat.updatedAt ?? statusCompat.updated_at ?? Date.now(),
          ),
          currentStep:
            statusCompat.currentStep ?? statusCompat.current_step ?? 'unknown',
          isActive: true,
        };
        this.activeSessions.set(status.threadId, session);
      }
      infoLog(
        `📚 [WORKFLOW] Loaded ${this.activeSessions.size} active sessions from database`,
      );
    } catch (error) {
      errorLog(`❌ [WORKFLOW] Error loading active sessions: ${error}`);
    }
  }
}
