import { WorkflowManager } from './manager';
import { WorkflowRegistry } from './registry';
// Removed PostgreSQL dependencies - using HTTP checkpointer only
import {
  ConversationHandler,
  ConversationMessage,
  ConversationResponse,
} from './workflows/conversation-handler';
import { FeedbackHandler, FeedbackInput } from './workflows/feedback-handler';
import { workflowFactories } from './workflows/factories';
import { WorkflowType } from './shared/types';
import { CLIHandler } from './io/cliHandler';
import { formatMealPlan } from './utils/formatMealPlan';
import type {
  WeeklyMealPlan as GeneratedWeeklyMealPlan,
  ShoppingListItem as GeneratedShoppingListItem,
} from '@mealplanner/generated';
import type { MealPlanningState } from './shared/types';
import { spawnSync } from 'child_process';
import { debugLog } from './logging';

export interface LangGraphAgentConfig {
  defaultParticipants?: string[];
}

export class LangGraphAgent {
  private workflowManager: WorkflowManager;
  private conversationHandler: ConversationHandler;
  private feedbackHandler: FeedbackHandler;
  private registry: WorkflowRegistry;
  private isInitialized = false;

  constructor(_config: LangGraphAgentConfig) {
    // Initialize registry and register factories
    this.registry = new WorkflowRegistry();
    for (const factory of workflowFactories) {
      this.registry.registerFactory(factory);
    }

    // Initialize workflow manager
    this.workflowManager = new WorkflowManager(this.registry);

    // Initialize handlers - we'll get the actual feedback handler after initialization
    this.feedbackHandler = new FeedbackHandler(
      this.workflowManager['checkpointer'],
    );
    this.conversationHandler = new ConversationHandler(
      this.workflowManager,
      this.feedbackHandler,
    );
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.workflowManager.initialize();
      this.isInitialized = true;

      const supportedTypes = this.workflowManager.getSupportedWorkflowTypes();
      debugLog(
        `🚀 [LANGGRAPH-AGENT] Initialized with ${supportedTypes.length} workflow types:${JSON.stringify(supportedTypes)}`,
      );
    } catch (error) {
      debugLog(`❌[LANGGRAPH - AGENT] Initialization failed: ${JSON.stringify(error)}`);
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
      debugLog(`🛑[LANGGRAPH - AGENT] Agent shut down successfully`);
    } catch (error) {
      debugLog(`❌[LANGGRAPH - AGENT] Shutdown error: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  /**
   * Handle a conversation message
   */
  async handleMessage(
    message: ConversationMessage,
  ): Promise<ConversationResponse> {
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
  async startWorkflow(
    type: WorkflowType,
    participants: string[] = ['brad'],
  ): Promise<string> {
    this.ensureInitialized();
    return await this.workflowManager.startWorkflow(type, {
      participants: participants,
    });
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
      workflowsByType: supportedTypes.reduce(
        (acc, type) => {
          acc[type] = allWorkflows.filter(
            (w) => w.workflowType === type,
          ).length;
          return acc;
        },
        {} as Record<WorkflowType, number>,
      ),
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: any;
  }> {
    try {
      if (!this.isInitialized) {
        return {
          status: 'unhealthy',
          details: { error: 'Agent not initialized' },
        };
      }

      const stats = await this.getStats();
      return {
        status: 'healthy',
        details: {
          ...stats,
          initialized: this.isInitialized,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(
        'Agent must be initialized before use. Call initialize() first.',
      );
    }
  }

  /**
   * Retrieve raw workflow state from checkpoint
   */
  async getWorkflowState(threadId: string): Promise<MealPlanningState> {
    this.ensureInitialized();
    // @ts-ignore
    const tuple = await this.workflowManager['checkpointer'].getTuple({
      configurable: { threadId: threadId },
    });
    if (!tuple) throw new Error(`No state found for thread ${threadId}`);
    const [checkpoint] = tuple;
    if (!checkpoint.state) {
      throw new Error('Invalid checkpoint state format');
    }
    return {
      threadId: checkpoint.state.threadId,
      workflow_type: WorkflowType.MEAL_PLANNING,
      participants: checkpoint.state.participants,
      created_at: checkpoint.state.createdAt ? checkpoint.state.createdAt.toDate() : new Date(),
      updated_at: checkpoint.state.updatedAt ? checkpoint.state.updatedAt.toDate() : new Date(),
      current_step: checkpoint.state.currentStep as any,
      meal_plan: checkpoint.state.mealPlan as any,
      feedback_history: checkpoint.state.feedbackHistory as any,
      iteration_count: checkpoint.state.iterationCount,
      shopping_list: checkpoint.state.shoppingList as any,
      is_finalized: checkpoint.state.isFinalized,
    } as MealPlanningState;
  }
}

// Example usage and backward compatibility
export async function createLangGraphMealPlannerAgent(
  config: LangGraphAgentConfig,
): Promise<LangGraphAgent> {
  const agent = new LangGraphAgent(config);
  await agent.initialize();
  return agent;
}

// CLI usage example
async function main() {
  const config: LangGraphAgentConfig = {
    defaultParticipants: ['brad', 'shannon'],
  };

  const agent = new LangGraphAgent(config);
  const io = new CLIHandler();
  const participants = config.defaultParticipants || ['brad'];
  const user = participants[0];
  let threadId: string | undefined;

  try {
    await agent.initialize();
    await io.sendMessage(
      'Welcome to the Meal Planner! Type your messages below.',
      'System',
    );

    while (true) {
      const input = await io.receiveInput('Your message', user);
      const response = await agent.handleMessage({
        from: user,
        message: input,
        timestamp: new Date(),
        threadId,
      });
      threadId = response.threadId;
      await io.sendMessage(response.message, 'Agent');

      if (response.currentStep === 'complete' || !response.success) {
        await io.sendMessage('Session ended.', 'System');
        if (threadId) {
          const state = await agent.getWorkflowState(threadId);
          if (state.meal_plan) {
            const { text, html } = formatMealPlan({
              days: state.meal_plan.days,
              shoppingList: (state.shopping_list ??
                []) as GeneratedShoppingListItem[],
            } as GeneratedWeeklyMealPlan);
            await io.sendMessage(text, 'System');
            debugLog(`\nHTML version:\n${html}`);

            // Auto copy HTML table to clipboard as HTML
            try {
              spawnSync('pbcopy', ['-Prefer', 'html'], { input: html });
              debugLog(`✅ HTML table copied to clipboard (as HTML)`);
            } catch (err) {
              debugLog(`⚠️ Failed to copy HTML to clipboard: ${JSON.stringify(err)}`);
            }
          }
        }
        break;
      }
    }
  } catch (error) {
    debugLog(`❌ Agent Error: ${JSON.stringify(error)} `);
  } finally {
    io.close();
    await agent.shutdown();
  }
}

// Run CLI example if this file is executed directly
// Only run in non-test environments
if (process.env.NODE_ENV !== 'test') {
  main().catch(console.error);
}
