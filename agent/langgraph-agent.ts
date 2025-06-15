import { WorkflowManager } from './manager.js';
import { WorkflowRegistry } from './registry.js';
import { PostgresCheckpointConfig } from './shared/checkpointer.js';
import { ConversationHandler, ConversationMessage, ConversationResponse } from './workflows/conversation-handler.js';
import { FeedbackHandler, FeedbackInput } from './workflows/feedback-handler.js';
import { workflowFactories } from './workflows/factories.js';
import { WorkflowType } from './shared/types.js';

export interface LangGraphAgentConfig {
  database: PostgresCheckpointConfig;
  defaultParticipants?: string[];
}

export class LangGraphAgent {
  private workflowManager: WorkflowManager;
  private conversationHandler: ConversationHandler;
  private feedbackHandler: FeedbackHandler;
  private registry: WorkflowRegistry;
  private isInitialized = false;

  constructor(config: LangGraphAgentConfig) {
    // Initialize registry and register factories
    this.registry = new WorkflowRegistry();
    for (const factory of workflowFactories) {
      this.registry.registerFactory(factory);
    }

    // Initialize workflow manager
    this.workflowManager = new WorkflowManager(config.database, this.registry);
    
    // Initialize handlers - we'll get the actual feedback handler after initialization
    this.feedbackHandler = new FeedbackHandler(this.workflowManager['checkpointer']);
    this.conversationHandler = new ConversationHandler(this.workflowManager, this.feedbackHandler);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.workflowManager.initialize();
      this.isInitialized = true;
      
      const supportedTypes = this.workflowManager.getSupportedWorkflowTypes();
      console.log(`🚀 [LANGGRAPH-AGENT] Initialized with ${supportedTypes.length} workflow types:`, supportedTypes);
    } catch (error) {
      console.error(`❌ [LANGGRAPH-AGENT] Initialization failed:`, error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      await this.workflowManager.shutdown();
      this.isInitialized = false;
      console.log(`🛑 [LANGGRAPH-AGENT] Agent shut down successfully`);
    } catch (error) {
      console.error(`❌ [LANGGRAPH-AGENT] Shutdown error:`, error);
      throw error;
    }
  }

  /**
   * Handle a conversation message
   */
  async handleMessage(message: ConversationMessage): Promise<ConversationResponse> {
    this.ensureInitialized();
    return await this.conversationHandler.handleMessage(message);
  }

  /**
   * Add feedback to a workflow
   */
  async addFeedback(feedback: FeedbackInput): Promise<boolean> {
    this.ensureInitialized();
    return await this.feedbackHandler.addFeedback(feedback);
  }

  /**
   * Start a new workflow
   */
  async startWorkflow(type: WorkflowType, participants: string[] = ['brad']): Promise<string> {
    this.ensureInitialized();
    return await this.workflowManager.startWorkflow(type, { participants });
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(threadId: string) {
    this.ensureInitialized();
    return await this.workflowManager.getWorkflowStatus(threadId);
  }

  /**
   * List all workflows
   */
  async listWorkflows(type?: WorkflowType) {
    this.ensureInitialized();
    return await this.workflowManager.listWorkflows(type);
  }

  /**
   * Resume a paused workflow
   */
  async resumeWorkflow(threadId: string, input: Record<string, any> = {}) {
    this.ensureInitialized();
    return await this.workflowManager.resumeWorkflow(threadId, input);
  }

  /**
   * Cancel a workflow
   */
  async cancelWorkflow(threadId: string): Promise<boolean> {
    this.ensureInitialized();
    return await this.workflowManager.cancelWorkflow(threadId);
  }

  /**
   * Get feedback for a workflow
   */
  async getFeedback(threadId: string) {
    this.ensureInitialized();
    return await this.feedbackHandler.getFeedback(threadId);
  }

  /**
   * Check if a workflow is awaiting feedback
   */
  async isAwaitingFeedback(threadId: string): Promise<boolean> {
    this.ensureInitialized();
    return await this.feedbackHandler.isAwaitingFeedback(threadId);
  }

  /**
   * Get system statistics
   */
  async getStats() {
    this.ensureInitialized();
    
    const activeSessionCount = this.workflowManager.getActiveSessionCount();
    const supportedTypes = this.workflowManager.getSupportedWorkflowTypes();
    const allWorkflows = await this.workflowManager.listWorkflows();
    
    return {
      activeSessionCount,
      supportedWorkflowTypes: supportedTypes,
      totalWorkflows: allWorkflows.length,
      workflowsByType: supportedTypes.reduce((acc, type) => {
        acc[type] = allWorkflows.filter(w => w.workflowType === type).length;
        return acc;
      }, {} as Record<WorkflowType, number>)
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy', details: any }> {
    try {
      if (!this.isInitialized) {
        return { status: 'unhealthy', details: { error: 'Agent not initialized' } };
      }

      const stats = await this.getStats();
      return { 
        status: 'healthy', 
        details: {
          ...stats,
          initialized: this.isInitialized
        }
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Agent must be initialized before use. Call initialize() first.');
    }
  }
}

// Example usage and backward compatibility
export async function createLangGraphMealPlannerAgent(config: LangGraphAgentConfig): Promise<LangGraphAgent> {
  const agent = new LangGraphAgent(config);
  await agent.initialize();
  return agent;
}

// CLI usage example
async function main() {
  const config: LangGraphAgentConfig = {
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'meal_planner_dev',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password'
    },
    defaultParticipants: ['brad', 'shannon']
  };

  const agent = new LangGraphAgent(config);
  
  try {
    await agent.initialize();
    
    // Example: Start a meal planning conversation
    const response = await agent.handleMessage({
      from: 'brad',
      message: 'Create a meal plan for this week',
      timestamp: new Date()
    });
    
    console.log('🤖 Agent Response:', response);
    
    if (response.threadId) {
      // Example: Check status
      const status = await agent.getWorkflowStatus(response.threadId);
      console.log('📊 Workflow Status:', status);
    }
    
  } catch (error) {
    console.error('❌ Agent Error:', error);
  } finally {
    await agent.shutdown();
  }
}

// Run CLI example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}