import { v4 as uuidv4 } from 'uuid';
import { RunnableConfig } from '@langchain/core/runnables';
import { WorkflowType, WorkflowState } from './shared/types.js';
import { PostgresCheckpointSaver, PostgresCheckpointConfig } from './shared/checkpointer.js';
import { WorkflowRegistry, BaseWorkflow } from './registry.js';

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
  input?: Record<string, any>;
  maxIterations?: number;
}

export class WorkflowManager {
  private checkpointer: PostgresCheckpointSaver;
  private registry: WorkflowRegistry;
  private activeSessions = new Map<string, WorkflowSession>();

  constructor(
    dbConfig: PostgresCheckpointConfig,
    registry: WorkflowRegistry
  ) {
    this.checkpointer = new PostgresCheckpointSaver(dbConfig);
    this.registry = registry;
  }

  async initialize(): Promise<void> {
    await this.checkpointer.connect();
    await this.loadActiveSessions();
  }

  async shutdown(): Promise<void> {
    await this.registry.cleanupAll();
    await this.checkpointer.disconnect();
  }

  // Start a new workflow session
  async startWorkflow(
    type: WorkflowType,
    options: WorkflowExecutionOptions = {}
  ): Promise<string> {
    if (!this.registry.isTypeSupported(type)) {
      throw new Error(`Unsupported workflow type: ${type}`);
    }

    const threadId = options.threadId || uuidv4();
    const participants = options.participants || ['brad'];

    // Create workflow session
    const session: WorkflowSession = {
      threadId,
      workflowType: type,
      participants,
      createdAt: new Date(),
      lastUpdated: new Date(),
      currentStep: 'initiate',
      isActive: true
    };

    this.activeSessions.set(threadId, session);

    // Get or create workflow instance
    const workflow = await this.registry.getOrCreateWorkflow(
      type,
      threadId,
      this.checkpointer
    );

    console.log(`🚀 [WORKFLOW] Started ${type} workflow with thread ID: ${threadId}`);
    return threadId;
  }

  // Execute a step in a workflow
  async executeWorkflowStep(
    threadId: string,
    input: Record<string, any> = {}
  ): Promise<any> {
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
      this.checkpointer
    );

    const config: RunnableConfig = {
      configurable: {
        thread_id: threadId,
        workflow_type: session.workflowType
      }
    };

    try {
      // Execute the workflow step
      const result = await workflow.graph.invoke(input, config);
      
      // Update session
      session.lastUpdated = new Date();
      session.currentStep = result.current_step || session.currentStep;
      
      // Check if workflow is complete
      if (result.current_step === 'complete') {
        session.isActive = false;
        console.log(`✅ [WORKFLOW] Completed ${session.workflowType} workflow: ${threadId}`);
      }

      return result;
    } catch (error) {
      console.error(`❌ [WORKFLOW] Error executing step for ${threadId}:`, error);
      throw error;
    }
  }

  // Resume a paused workflow
  async resumeWorkflow(
    threadId: string,
    input: Record<string, any> = {}
  ): Promise<any> {
    // Check if session exists in memory
    let session = this.activeSessions.get(threadId);
    
    // If not in memory, try to load from database
    if (!session) {
      const status = await this.checkpointer.getWorkflowStatus(threadId);
      if (status) {
        session = {
          threadId,
          workflowType: status.workflow_type,
          participants: ['brad'], // Default participant, could be enhanced
          createdAt: status.created_at,
          lastUpdated: status.updated_at,
          currentStep: status.current_step,
          isActive: status.current_step !== 'complete'
        };
        this.activeSessions.set(threadId, session);
      }
    }

    if (!session) {
      throw new Error(`No workflow found for thread ID: ${threadId}`);
    }

    if (!session.isActive) {
      throw new Error(`Workflow ${threadId} is already complete`);
    }

    console.log(`🔄 [WORKFLOW] Resuming ${session.workflowType} workflow: ${threadId}`);
    return await this.executeWorkflowStep(threadId, input);
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

    console.log(`🛑 [WORKFLOW] Cancelled ${session.workflowType} workflow: ${threadId}`);
    return true;
  }

  // Get workflow status
  async getWorkflowStatus(threadId: string): Promise<WorkflowSession | null> {
    const session = this.activeSessions.get(threadId);
    if (session) {
      return { ...session };
    }

    // Try to load from database if not in memory
    const status = await this.checkpointer.getWorkflowStatus(threadId);
    if (status) {
      const session: WorkflowSession = {
        threadId,
        workflowType: status.workflow_type,
        participants: ['brad'], // Default, could be enhanced
        createdAt: status.created_at,
        lastUpdated: status.updated_at,
        currentStep: status.current_step,
        isActive: status.current_step !== 'complete'
      };
      return session;
    }

    return null;
  }

  // List all workflows
  async listWorkflows(type?: WorkflowType): Promise<WorkflowSession[]> {
    const dbWorkflows = await this.checkpointer.listWorkflows(type);
    const sessions: WorkflowSession[] = [];

    for (const dbWorkflow of dbWorkflows) {
      const session = this.activeSessions.get(dbWorkflow.thread_id);
      if (session) {
        sessions.push({ ...session });
      } else {
        // Create session from database data
        const status = await this.checkpointer.getWorkflowStatus(dbWorkflow.thread_id);
        if (status) {
          sessions.push({
            threadId: dbWorkflow.thread_id,
            workflowType: dbWorkflow.workflow_type,
            participants: ['brad'], // Default, could be enhanced
            createdAt: dbWorkflow.created_at,
            lastUpdated: dbWorkflow.updated_at,
            currentStep: status.current_step,
            isActive: status.current_step !== 'complete'
          });
        }
      }
    }

    return sessions.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
  }

  // Get active sessions count
  getActiveSessionCount(): number {
    return Array.from(this.activeSessions.values()).filter(s => s.isActive).length;
  }

  // Get supported workflow types
  getSupportedWorkflowTypes(): WorkflowType[] {
    return this.registry.getSupportedTypes();
  }

  // Private method to load active sessions from database
  private async loadActiveSessions(): Promise<void> {
    try {
      const workflows = await this.checkpointer.listWorkflows();
      for (const workflow of workflows) {
        const status = await this.checkpointer.getWorkflowStatus(workflow.thread_id);
        if (status && status.current_step !== 'complete') {
          const session: WorkflowSession = {
            threadId: workflow.thread_id,
            workflowType: workflow.workflow_type,
            participants: ['brad'], // Default, could be enhanced
            createdAt: workflow.created_at,
            lastUpdated: workflow.updated_at,
            currentStep: status.current_step,
            isActive: true
          };
          this.activeSessions.set(workflow.thread_id, session);
        }
      }
      console.log(`📚 [WORKFLOW] Loaded ${this.activeSessions.size} active sessions from database`);
    } catch (error) {
      console.error('❌ [WORKFLOW] Error loading active sessions:', error);
    }
  }
}