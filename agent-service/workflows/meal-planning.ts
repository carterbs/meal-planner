import { infoLog, warnLog, errorLog } from '../logging';
import { ChatOpenAI } from '@langchain/openai';
import { FakeChatModel } from '@langchain/core/utils/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  WeeklyMealPlan as GeneratedWeeklyMealPlan,
  Meal as GeneratedMeal,
  ShoppingListItem,
  ShoppingList,
} from '@mealplanner/generated';
import type { ExtendedRunnableConfig } from '../shared/types';
import {
  WeeklyMealPlan,
  AgentCheckpoint,
  AgentCheckpointMetadata,
  MealPlanEntry,
} from '@mealplanner/generated';
import { MealPlanningCheckpointState } from '@mealplanner/generated';
import { Timestamp } from '@bufbuild/protobuf';
import {
  MealPlanningState,
  MealPlanningStep,
  WorkflowType,
  VALIDATION_CRITERIA,
} from '../shared/types';
import { BaseWorkflow } from '../registry';
import { debugLog } from '../logging';
import { DbCheckpointSaver } from '../shared/dbCheckpointer';
import { FeedbackHandler } from './feedback-handler';
import {
  ShoppingListResponse,
  MCPToolResult as MCPToolResultType,
} from '../shared/mcp-types';
import { DAYS_OF_THE_WEEK } from '../shared/days';
import {
  getAnalyzeFeedbackPrompt,
  getUpdateMealPlanPrompt,
  getOptimizeMealPlanPrompt,
  getPantryStaplesCategorizationPrompt,
} from './meal-planning-prompts';
import { v4 as uuidv4 } from 'uuid';
import { MessageRepository } from '../database/messages';
// Extracted node imports (keep imports at top of file)
import { initiateNode as initiateNodeExternal } from './meal-planning/nodes/initiate.js';
import { generatePlanNode as generatePlanNodeExternal } from './meal-planning/nodes/generatePlan.js';
import { presentPlanNode as presentPlanNodeExternal } from './meal-planning/nodes/presentPlan.js';
import { optimizePlanNode as optimizePlanNodeExternal } from './meal-planning/nodes/optimizePlan.js';
import { finalizePlanNode as finalizePlanNodeExternal } from './meal-planning/nodes/finalizePlan.js';
import { generateShoppingListNode as generateShoppingListNodeExternal } from './meal-planning/nodes/generateShoppingList.js';
const DEBUG_LOGS = false;
/**
 * Meal planning workflow
 */
export class MealPlanningWorkflow implements BaseWorkflow {
  private messageRepo: MessageRepository;
  private isConnectedToMCP: boolean = false;
  /**
   * Helper to extract JSON from LLM responses (removes markdown code fences, whitespace, etc)
   */
  private extractJsonFromResponse(response: string): string {
    return response
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
  }
  /**
   * Helper to update proto state with partial updates
   */
  private updateState(
    currentState: MealPlanningState,
    updates: Partial<MealPlanningState>,
  ): MealPlanningState {
    // Use the generated constructor to clone the existing message so we keep
    // all proto fields intact (including nested Timestamps). Then overlay the
    // updates object.
    const merged = new MealPlanningCheckpointState(currentState);
    Object.assign(merged as any, updates);
    merged.updatedAt = Timestamp.fromDate(new Date());
    return merged;
  }
  /**
   * Add a message to the messages table via direct DB access
   */
  private async addMessage(
    threadId: string,
    sender: string,
    message: string,
  ): Promise<void> {
    try {
      await this.messageRepo.addMessage(threadId, sender, message);
      await debugLog(`[MESSAGE] Added ${sender} message to thread ${threadId}`);
    } catch (err) {
      await warnLog(`⚠️ [MESSAGE] Failed to add ${sender} message: ${err}`);
      // Don't throw - message persistence shouldn't break the workflow
    }
  }
  /**
   * Get messages from the messages table via direct DB access
   */
  private async getMessages(threadId: string): Promise<string[]> {
    try {
      const messages = await this.messageRepo.getMessages(threadId);
      // Filter for user messages and extract just the message content
      const userMessages = messages
        .filter((msg) => msg.sender === 'user')
        .map((msg) => msg.text || '')
        .filter((content: string) => content.trim().length > 0);
      await debugLog(
        `[MESSAGE] Retrieved ${userMessages.length} user messages from thread ${threadId}`,
      );
      return userMessages;
    } catch (err) {
      await warnLog(`⚠️ [MESSAGE] Failed to get messages: ${err}`);
      return []; // Return empty array on error
    }
  }
  readonly type = WorkflowType.MEAL_PLANNING;
  readonly graph: {
    invoke: (
      input: unknown,
      config: ExtendedRunnableConfig,
    ) => Promise<MealPlanningState>;
  };
  private client: Client;
  private llm!: ChatOpenAI | FakeChatModel;
  private nanoLlm!: ChatOpenAI | FakeChatModel;
  private checkpointer: DbCheckpointSaver;
  private feedbackHandler: FeedbackHandler;
  constructor(checkpointer: DbCheckpointSaver) {
    this.messageRepo = new MessageRepository();
    this.checkpointer = checkpointer;
    this.feedbackHandler = new FeedbackHandler(checkpointer);
    // Create a unique client name to avoid conflicts between workflow instances
    const clientId = Math.random().toString(36).substring(7);
    this.client = new Client({
      name: `meal-planner-workflow-${clientId}`,
      version: '1.0.0',
    });
    // Create workflow graph
    this.graph = this.createGraph();
  }
  private async saveCheckpoint(
    config: ExtendedRunnableConfig,
    state: MealPlanningState,
  ): Promise<void> {
    await infoLog('MealPlanningWorkflow.saveCheckpoint called');
    // DEBUGGING: Log meal plan before checkpoint serialization (saveCheckpoint)
    if (state.mealPlan) {
      await infoLog(
        '🔍 [SAVE-CHECKPOINT] mealPlan before checkpoint serialization:',
      );
      if (state.mealPlan.days) {
        for (let i = 0; i < state.mealPlan.days.length; i++) {
          const day = state.mealPlan.days[i];
          await infoLog(
            `🔍 [SAVE-CHECKPOINT] Entry ${i}: dayIndex=${day.dayIndex}, mealType=${day.mealType}, meal=${day.meal?.name || 'nil'}`,
          );
        }
      }
    }
    await infoLog(
      `🔍 [SAVE-CHECKPOINT] mealPlan before checkpoint serialization: ${JSON.stringify(state)}`,
    );
    let checkpoint: AgentCheckpoint;
    try {
      checkpoint = new AgentCheckpoint({
        state: state,
        next: [],
        step: 0,
      });
    } catch (e) {
      // log every lastPlanned value
      if (state.mealPlan) {
        for (const day of state.mealPlan.days) {
          if (day.meal) {
            await infoLog(
              `🔍 [SAVE-CHECKPOINT] lastPlanned: ${day.meal.lastPlanned}`,
            );
          }
        }
      }
      throw e;
    }
    const metadata = new AgentCheckpointMetadata({
      source: 'workflow',
      step: 0,
    });
    await this.checkpointer.put(config, checkpoint, metadata);
  }
  async ensureMCPClient(): Promise<void> {
    await infoLog(
      `ensureMCPClient called - isConnectedToMCP: ${this.isConnectedToMCP}`,
    );
    if (this.isConnectedToMCP) {
      await infoLog('MCP client already connected, skipping initialization');
      return;
    }
    await infoLog('Connecting to MCP client...');
    this.isConnectedToMCP = true;
    const mcpPort = process.env.MCP_PORT
      ? parseInt(process.env.MCP_PORT)
      : 3001;
    const mcpHost = process.env.MCP_HOST || 'localhost';
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://${mcpHost}:${mcpPort}/mcp`),
    );
    await this.client.connect(transport);
    await infoLog('MCP client connected successfully');
  }
  async initialize(): Promise<void> {
    await infoLog('MealPlanningWorkflow.initialize called');
    const isCodex = process.argv.includes('--codex');
    await infoLog(
      `🍽️ [MEAL-WORKFLOW] Starting to initialize meal planning workflow`,
    );
    await this.ensureMCPClient();
    // Initialize LLM
    const isTestMode = process.env.NODE_ENV === 'test';
    this.llm = isCodex
      ? new FakeChatModel({})
      : new ChatOpenAI({
        temperature: 0,
        modelName: isTestMode ? 'gpt-4.1-nano' : 'gpt-4.1',
      });
    // Initialize nano LLM for feedback analysis
    this.nanoLlm = new ChatOpenAI({
      temperature: 0,
      modelName: 'gpt-4.1-nano',
    });
    await infoLog(`🍽️ [MEAL-WORKFLOW] Initialized meal planning workflow`);
  }
  async cleanup(): Promise<void> {
    await infoLog('MealPlanningWorkflow.cleanup called');
    if (this.client) {
      await this.client.close();
    }
  }
  // Expose feedback handler for external use
  getFeedbackHandler(): FeedbackHandler {
    return this.feedbackHandler;
  }
  private createGraph() {
    return {
      invoke: async (input: unknown, config: ExtendedRunnableConfig) => {
        await infoLog('MealPlanningWorkflow.invoke called');
        await infoLog(
          `${`🍽️ [MEAL-WORKFLOW] Invoking workflow; input:`} ${input}`,
        );
        // Load checkpoint
        const tuple = await this.checkpointer.getTuple(config);
        let state: MealPlanningState;
        if (!tuple) {
          // Initial run
          state = new MealPlanningCheckpointState({
            threadId: config.configurable?.threadId ?? uuidv4(),
            participants: ['brad'],
            createdAt: Timestamp.fromDate(new Date()),
            updatedAt: Timestamp.fromDate(new Date()),
            currentStep: MealPlanningStep.INITIATE,
            mealPlan: undefined,
            feedbackHistory: [],
            iterationCount: 0,
            shoppingList: undefined,
            isFinalized: false,
          });
          // Generate, optimize, present, pause for feedback
          const initiateResult = await initiateNodeExternal(state);
          await infoLog(
            `Debuggyz - Initiated the workflow. Current Step: ${initiateResult.currentStep}`,
          );
          state = this.updateState(state, initiateResult);
          await this.saveCheckpoint(config, state);
          await infoLog(
            `Debuggyz - After updating state. Current Step: ${state.currentStep}`,
          );
          const generateResult = await generatePlanNodeExternal(state, {
            callTool: (args: { name: string; arguments: Record<string, unknown> }) =>
              this.client.callTool(args),
            extractJsonFromResponse: (s: string) => this.extractJsonFromResponse(s),
          });
          await infoLog(
            `Debuggyz - Generated the plan. Current Step: ${generateResult.currentStep}`,
          );
          state = this.updateState(state, generateResult);
          await this.saveCheckpoint(config, state);
          await infoLog(
            `Debuggyz - After updating state. Current Step: ${state.currentStep}`,
          );
          const optimizeResult = await this.optimizePlanNode(state);
          await infoLog(
            `Debuggyz - Optimized the plan. ${optimizeResult.currentStep}`,
          );
          state = this.updateState(state, optimizeResult);
          await this.saveCheckpoint(config, state);
          await infoLog(
            `Debuggyz - After updating state. Current Step: ${state.currentStep}`,
          );
          const presentResult = await presentPlanNodeExternal(state);
          await infoLog(
            `Debuggyz - Presenting the plan. Current Step: ${optimizeResult.currentStep}`,
          );
          state = this.updateState(state, presentResult);
          await this.saveCheckpoint(config, state);
          await infoLog(
            `Debuggyz - After updating state. Current Step: ${state.currentStep}`,
          );
          // Pause: checkpoint state
          // Debug: log the final state before saving checkpoint
          await infoLog(
            `🔍 [WORKFLOW] Final state before checkpoint: current_step=${state.currentStep}`,
          );
          await infoLog(
            `${`🔍 [WORKFLOW] Full state:`} ${JSON.stringify(state, null, 2)}`,
          );
          await this.saveCheckpoint(config, state);
          await infoLog(
            `🔍 [WORKFLOW] Saved checkpoint for thread ${config.configurable?.threadId}`,
          );
          return state;
        } else {
          // Resume run: feedback loop
          const [checkpoint] = tuple;
          // Properly deserialize state from checkpoint
          if (!checkpoint.state) {
            throw new Error('Invalid checkpoint state format');
          }
          // Properly deserialize the meal_plan from checkpoint using fromJson
          let deserializedMealPlan = null;
          if (checkpoint.state.mealPlan) {
            // DEBUGGING: Log mealPlan before deserialization
            await infoLog(
              '🔍 [CHECKPOINT] mealPlan before WeeklyMealPlan.fromJson:',
            );
            await infoLog(JSON.stringify(checkpoint.state.mealPlan, null, 2));
            deserializedMealPlan = WeeklyMealPlan.fromJson(
              checkpoint.state.mealPlan.toJson(),
            );
            // DEBUGGING: Log mealPlan after deserialization
            await infoLog(
              '🔍 [CHECKPOINT] mealPlan after WeeklyMealPlan.fromJson:',
            );
            if (deserializedMealPlan.days) {
              for (let i = 0; i < deserializedMealPlan.days.length; i++) {
                const day = deserializedMealPlan.days[i];
                await infoLog(
                  `🔍 [CHECKPOINT] Entry ${i}: dayIndex=${day.dayIndex}, mealType=${day.mealType}, meal=${day.meal?.name || 'nil'}`,
                );
              }
            }
          }
          // Use checkpoint state directly since it's already a proto
          state = checkpoint.state;
          // Update meal plan if we deserialized it
          if (deserializedMealPlan) {
            state = new MealPlanningCheckpointState({
              ...state,
              mealPlan: deserializedMealPlan,
            });
          }
          await infoLog(
            `🔄 [MEAL-WORKFLOW] Resuming workflow at step ${state.currentStep}`,
          );
          // On resume, always: apply feedback (if any), re-optimize, present, and pause for feedback again until user is happy
          let feedbackSatisfied = false;
          if (!checkpoint.state.updatedAt) {
            throw new Error('Invalid checkpoint state format');
          }
          while (!feedbackSatisfied) {
            const lastUpdate = checkpoint.state.updatedAt.toDate();
            // 1. Gather all recent feedback (within last 5 minutes)
            const allFeedback = await this.messageRepo.getMessagesForProtobuf(
              state.threadId,
            );
            // Add a small buffer (5 seconds) to handle race conditions between message creation and workflow updates
            const lastUpdateWithBuffer = new Date(lastUpdate.getTime() - 5000);
            const newFeedback = allFeedback.filter((f: any) =>
              f.created_at
                ? new Date(f.created_at) > lastUpdateWithBuffer
                : true,
            );
            await infoLog('New feedback?', {
              newFeedbackLength: newFeedback.length.toString(),
              allFeedbackLength: allFeedback.length.toString(),
            });
            // 2. Analyze feedback to determine user satisfaction
            let analyzeResult = { satisfied: false, reasoning: '' };
            if (newFeedback.length > 0) {
              analyzeResult = await this.analyzeFeedbackNode(newFeedback);
            }
            // 3. If satisfied, finalize plan and break loop
            if (analyzeResult.satisfied) {
              state = this.updateState(state, {
                currentStep: MealPlanningStep.FINALIZE_PLAN,
              });
              feedbackSatisfied = true;
              break;
            }
            // 4. If there is new feedback and not satisfied, apply it
            if (newFeedback.length > 0) {
              // Apply feedback via LLM
              const stateWithFeedback = Object.assign(state, {
                feedback_to_apply: newFeedback,
              });
              const feedbackResult =
                await this.applyFeedbackNode(stateWithFeedback);
              state = this.updateState(state, feedbackResult);
              // Feedback applied - continue processing
              const optimizeResult = await this.optimizePlanNode(state);
              state = this.updateState(state, optimizeResult);
              await this.saveCheckpoint(config, state);
            }
            // 5. Present the plan after feedback is processed/applied
            const presentResult = await this.presentPlanNode(state);
            state = this.updateState(state, presentResult);
            await this.saveCheckpoint(config, state);
            // 6. Pause for feedback after presenting the plan
            if (state.currentStep === MealPlanningStep.AWAIT_FEEDBACK) {
              // Create properly typed checkpoint
              // DEBUGGING: Log meal plan before checkpoint serialization (feedback loop)
              if (state.mealPlan) {
                await infoLog(
                  '🔍 [CHECKPOINT-SAVE-FEEDBACK] mealPlan before checkpoint serialization:',
                );
                if (state.mealPlan.days) {
                  for (let i = 0; i < state.mealPlan.days.length; i++) {
                    const day = state.mealPlan.days[i];
                    await infoLog(
                      `🔍 [CHECKPOINT-SAVE-FEEDBACK] Entry ${i}: dayIndex=${day.dayIndex}, mealType=${day.mealType}, meal=${day.meal?.name || 'nil'}`,
                    );
                  }
                }
              }
              // DEBUGGING: Check if meal_plan is properly set before final checkpoint
              await infoLog(
                `🔍 [FINAL-CHECKPOINT] About to save final checkpoint with mealPlan: ${state.mealPlan ? 'EXISTS' : 'NULL/UNDEFINED'}`,
              );
              if (state.mealPlan) {
                await infoLog(
                  `🔍 [FINAL-CHECKPOINT] meal_plan has ${state.mealPlan.days?.length || 0} days`,
                );
              }
              // State is already a proto object
              const checkpoint = new AgentCheckpoint({
                state: state,
                next: [],
                step: 0,
              });
              const metadata = new AgentCheckpointMetadata({
                source: 'workflow',
                step: 0,
              });
              await this.checkpointer.put(config, checkpoint, metadata);
              return state;
            }
            // 7. If feedback is positive, break loop and finalize
            if (state.currentStep === MealPlanningStep.FINALIZE_PLAN) {
              feedbackSatisfied = true;
            }
          }
          await infoLog(
            `🔍 [WORKFLOW] Finalizing plan for thread ${config.configurable?.threadId}`,
          );
          // Finalize, generate shopping list, complete
          const finalizeResult = await this.finalizePlanNode(state);
          state = this.updateState(state, finalizeResult);
          await infoLog(
            `🔍 [WORKFLOW] Generating shopping list for thread ${config.configurable?.threadId}`,
          );
          const shoppingResult = await this.generateShoppingListNode(state);
          await infoLog(
            `🔍 [WORKFLOW] Generated shopping list for thread ${config.configurable?.threadId}`,
          );
          state = this.updateState(state, shoppingResult);
          await infoLog(
            `🔍 [WORKFLOW] Completed workflow for thread ${config.configurable?.threadId}`,
          );
          const completeResult = await this.completeNode(state);
          state = this.updateState(state, completeResult);
          return state;
        }
      },
    };
  }
  // Compatibility wrappers for tests that call internal node methods
  private async initiateNode(
    state: MealPlanningState,
  ): Promise<Partial<MealPlanningState>> {
    return initiateNodeExternal(state);
  }
  private async generatePlanNode(
    state: MealPlanningState,
  ): Promise<Partial<MealPlanningState>> {
    return generatePlanNodeExternal(state, {
      callTool: (args: { name: string; arguments: Record<string, unknown> }) =>
        this.client.callTool(args),
      extractJsonFromResponse: (s: string) => this.extractJsonFromResponse(s),
    });
  }
  // Node implementations moved to ./meal-planning/nodes
  private async optimizePlanNode(
    state: MealPlanningState,
  ): Promise<Partial<MealPlanningState>> {
    return optimizePlanNodeExternal(state, {
      validatePlan: (p) => this.validatePlan(p),
      optimizePlanWithLLM: (p, issues) => this.optimizePlanWithLLM(p, issues),
    });
  }
  // New: apply feedback using LLM with feedback context
  private async applyFeedbackNode(
    state: MealPlanningState & {
      feedback_to_apply?: any[];
    },
  ): Promise<Partial<MealPlanningState>> {
    await infoLog('MealPlanningWorkflow.applyFeedbackNode called');
    await infoLog(`🍽️ [MEAL-WORKFLOW] Applying user feedback via LLM`);
    if (!state.mealPlan) {
      throw new Error('No meal plan to apply feedback to');
    }
    // Gather ALL feedback from the entire session or use provided feedback_to_apply
    const feedbackMessages = state.feedback_to_apply
      ? state.feedback_to_apply.map((f) => f.content)
      : await this.getMessages(state.threadId);
    // Call LLM to pick alternatives based on feedback
    const result = await this.applyFeedbackWithLLM(
      state.mealPlan,
      feedbackMessages,
    );
    // Store the LLM's response message in the database
    if (result.userMessage) {
      await this.addMessage(state.threadId, 'agent', result.userMessage);
    }
    return {
      mealPlan: result.mealPlan,
    };
  }
  // Analyze feedback using nano LLM. Returns { satisfied: boolean, reasoning: string }
  private async analyzeFeedbackNode(feedbackEntries: any[]): Promise<{
    satisfied: boolean;
    reasoning: string;
  }> {
    await infoLog('MealPlanningWorkflow.analyzeFeedbackNode called');
    const latestFeedback = feedbackEntries[feedbackEntries.length - 1];
    await infoLog(
      `🍽️ [MEAL-WORKFLOW] Analyzing feedback: ${latestFeedback.content}`,
    );
    const prompt = getAnalyzeFeedbackPrompt(latestFeedback.content);
    const result = await this.nanoLlm.invoke([
      { role: 'user', content: prompt },
    ]);
    await infoLog(`🍽️ [MEAL-WORKFLOW] Analyzed feedback: ${result.content}`);
    let analysis = {
      satisfied: false,
      reasoning: 'Could not parse LLM response.',
    };
    try {
      analysis = JSON.parse(
        this.extractJsonFromResponse(
          typeof result.content === 'string'
            ? result.content
            : JSON.stringify(result.content),
        ),
      );
    } catch (err) {
      await errorLog(
        `❌ [MEAL-WORKFLOW] Failed to parse feedback analysis response: ${err}`,
      );
    }
    return analysis;
  }
  private async applyFeedbackWithLLM(
    plan: GeneratedWeeklyMealPlan,
    feedback: string[],
  ): Promise<{
    mealPlan: GeneratedWeeklyMealPlan;
    userMessage: string;
  }> {
    await infoLog('MealPlanningWorkflow.applyFeedbackWithLLM called');
    const t0 = Date.now();
    await debugLog(
      `[FEEDBACK] applyFeedbackWithLLM start (feedbackCount=${feedback.length})`,
    );
    // Fetch available meals
    const mealsResp = await this.client.callTool({
      name: 'getMeals',
      arguments: {},
    });
    const availableMeals: GeneratedMeal[] = JSON.parse(
      this.extractJsonFromResponse(
        (mealsResp as MCPToolResultType).content[0].text,
      ),
    );
    const mealOptions = availableMeals
      .map(
        (m) =>
          `${m.id}: ${m.name} (${m.mealType}, effort: ${m.effort}, red meat: ${m.hasRedMeat})`,
      )
      .join('\n');
    const dayNames = DAYS_OF_THE_WEEK;
    const planDescription = plan.days
      .filter((day) => day.meal)
      .map(
        (day) =>
          `${dayNames[day.dayIndex]} ${day.mealType}: ${day.meal!.name} (ID: ${day.meal!.id}, effort: ${day.meal!.effort}, red meat: ${day.meal!.hasRedMeat})`,
      )
      .join('\n');
    const feedbackText =
      feedback.length > 0
        ? `ALL USER FEEDBACK FROM THIS SESSION (in chronological order):\n${feedback.map((msg, idx) => `${idx + 1}. ${msg}`).join('\n')}\n`
        : '';
    const prompt = getUpdateMealPlanPrompt(
      feedbackText,
      planDescription,
      mealOptions,
    );
    await infoLog(`🤖 [MEAL-WORKFLOW] Calling into the LLM`);
    const result = await this.llm.invoke([{ role: 'user', content: prompt }]);
    const llmResponse =
      typeof result.content === 'string'
        ? result.content
        : JSON.stringify(result.content);
    await infoLog(`🤖 [MEAL-WORKFLOW] Raw LLM response:`);
    await infoLog(llmResponse);
    await infoLog(
      `${`🤖 [MEAL-WORKFLOW] Feedback being processed:`} ${feedbackText}`,
    );
    // Create a proper WeeklyMealPlan object to preserve protobuf structure
    let updatedPlan: WeeklyMealPlan = plan;
    let userMessage = "I've updated your meal plan based on your feedback!"; // Default fallback message
    try {
      const cleanedResponse = this.extractJsonFromResponse(llmResponse);
      await infoLog(`🤖 [MEAL-WORKFLOW] Cleaned JSON response:`);
      await infoLog(cleanedResponse);
      const recommendations = JSON.parse(cleanedResponse);
      // Extract user message from LLM response
      if (
        recommendations.userMessage &&
        typeof recommendations.userMessage === 'string'
      ) {
        userMessage = recommendations.userMessage;
      }
      // Handle removals first
      if (recommendations.removals && Array.isArray(recommendations.removals)) {
        for (const removal of recommendations.removals) {
          const { day, mealType, reason } = removal;
          const dayIndex = dayNames.indexOf(day);
          if (dayIndex >= 0) {
            await infoLog(
              `🤖 [MEAL-WORKFLOW] Applying removal from the LLM: Remove ${day} ${mealType} - ${reason}`,
            );
            // Handle "all" mealType by removing each meal type individually
            const mealTypesToRemove =
              mealType === 'all'
                ? ['breakfast', 'lunch', 'dinner']
                : [mealType];
            // Apply all removals locally to avoid race conditions with multiple MCP calls
            for (const specificMealType of mealTypesToRemove) {
              await infoLog(
                `🤖 [MEAL-WORKFLOW] Applying local removal: dayIndex=${dayIndex}, mealType=${specificMealType}`,
              );
              // Find and remove the meal from the local plan
              updatedPlan.days = updatedPlan.days.map((planDay) => {
                if (
                  planDay.dayIndex === dayIndex &&
                  planDay.mealType === specificMealType
                ) {
                  // Remove the meal by setting it to null
                  return new MealPlanEntry({
                    dayIndex: planDay.dayIndex,
                    mealType: planDay.mealType,
                    meal: undefined,
                  });
                }
                return planDay;
              });
            }
          }
        }
      }
      // Handle replacements
      if (
        recommendations.replacements &&
        Array.isArray(recommendations.replacements)
      ) {
        for (const replacement of recommendations.replacements) {
          const { day, mealType, oldMealId, newMealId, reason } = replacement;
          const dayIndex = dayNames.indexOf(day);
          const newMeal = availableMeals.find((m) => m.id === newMealId);
          if (dayIndex >= 0 && newMeal && newMeal.mealType === mealType) {
            await infoLog(
              `🤖 [MEAL-WORKFLOW] Applying feedback from the LLM: Replace ${day} ${mealType} (ID ${oldMealId}) with ${newMeal.name} (ID ${newMealId}) - ${reason}`,
            );
            updatedPlan.days = updatedPlan.days.map((planDay) => {
              if (
                planDay.dayIndex === dayIndex &&
                planDay.mealType === mealType
              ) {
                return new MealPlanEntry({
                  dayIndex: planDay.dayIndex,
                  mealType: planDay.mealType,
                  meal: newMeal,
                });
              }
              return planDay;
            });
          }
        }
      }
    } catch (error) {
      await errorLog(
        `❌ [MEAL-WORKFLOW] Failed to parse LLM feedback response: ${error}`,
      );
      userMessage =
        "I've made some adjustments to your meal plan based on your feedback."; // Fallback on error
    }
    await debugLog(
      `[FEEDBACK] applyFeedbackWithLLM finished in ${Date.now() - t0}ms`,
    );
    return { mealPlan: updatedPlan, userMessage };
  }
  private async presentPlanNode(
    state: MealPlanningState,
  ): Promise<Partial<MealPlanningState>> {
    return presentPlanNodeExternal(state);
  }
  private async finalizePlanNode(
    state: MealPlanningState,
  ): Promise<Partial<MealPlanningState>> {
    return finalizePlanNodeExternal(state, {
      callTool: (args) => this.client.callTool(args),
    });
  }
  private async generateShoppingListNode(
    state: MealPlanningState,
  ): Promise<Partial<MealPlanningState>> {
    return generateShoppingListNodeExternal(state, {
      callTool: (args) => this.client.callTool(args),
    });
  }
  private async completeNode(
    state: MealPlanningState,
  ): Promise<Partial<MealPlanningState>> {
    await infoLog('MealPlanningWorkflow.completeNode called');
    await infoLog(`🍽️ [MEAL-WORKFLOW] Meal planning workflow completed`);
    // Final validation
    const finalIssues = state.mealPlan ? this.validatePlan(state.mealPlan) : [];
    if (finalIssues.length > 0) {
      await warnLog(
        `${`⚠️ [MEAL-WORKFLOW] Final plan has issues:`} ${finalIssues}`,
      );
    }
    return {
      currentStep: MealPlanningStep.COMPLETE,
    };
  }
  private validatePlan(plan: GeneratedWeeklyMealPlan): string[] {
    const issues: string[] = [];
    // Check consecutive high-effort meals
    let consecutiveHighEffort = 0;
    for (const day of plan.days) {
      if (day.meal && day.meal.effort > 3) {
        consecutiveHighEffort++;
        if (
          consecutiveHighEffort > VALIDATION_CRITERIA.maxConsecutiveHighEffort
        ) {
          issues.push(
            `Too many consecutive high-effort meals (day ${day.dayIndex})`,
          );
        }
      } else {
        consecutiveHighEffort = 0;
      }
    }
    // Check red meat count
    const redMeatCount = plan.days.filter((d) => d.meal?.hasRedMeat).length;
    if (redMeatCount > VALIDATION_CRITERIA.maxRedMeatPerWeek) {
      issues.push(
        `Too many red meat meals: ${redMeatCount} (max ${VALIDATION_CRITERIA.maxRedMeatPerWeek})`,
      );
    }
    // Check for duplicates
    const mealIds = plan.days
      .map((d) => d.meal?.id)
      .filter((id): id is number => id !== undefined);
    const duplicates = mealIds.filter(
      (id, index) => mealIds.indexOf(id) !== index,
    );
    if (duplicates.length > 0) {
      issues.push(`Duplicate meals found: ${duplicates.join(', ')}`);
    }
    return issues;
  }
  private async optimizePlanWithLLM(
    plan: GeneratedWeeklyMealPlan,
    issues: string[],
  ): Promise<GeneratedWeeklyMealPlan> {
    await infoLog('MealPlanningWorkflow.optimizePlanWithLLM called');
    // Fetch available meals
    const mealsResp = await this.client.callTool({
      name: 'getMeals',
      arguments: {},
    });
    const availableMeals: GeneratedMeal[] = JSON.parse(
      (mealsResp as MCPToolResultType).content[0].text,
    );
    // Create concise meal options for the prompt
    const mealOptions = availableMeals
      .map(
        (m) =>
          `${m.id}: ${m.name} (${m.mealType}, effort: ${m.effort}, red meat: ${m.hasRedMeat})`,
      )
      .join('\n');
    const dayNames = DAYS_OF_THE_WEEK;
    const planDescription = plan.days
      .filter((day) => day.meal)
      .map(
        (day) =>
          `${dayNames[day.dayIndex]} ${day.mealType}: ${day.meal!.name} (ID: ${day.meal!.id}, effort: ${day.meal!.effort}, red meat: ${day.meal!.hasRedMeat})`,
      )
      .join('\n');
    const prompt = getOptimizeMealPlanPrompt(
      issues,
      planDescription,
      mealOptions,
    );
    const result = await this.llm.invoke([{ role: 'user', content: prompt }]);
    const llmResponse =
      typeof result.content === 'string'
        ? result.content
        : JSON.stringify(result.content);
    // Parse and apply recommendations
    let optimizedPlan = { ...plan, days: [...plan.days] };
    try {
      const recommendations = JSON.parse(
        this.extractJsonFromResponse(llmResponse),
      );
      if (
        recommendations.replacements &&
        Array.isArray(recommendations.replacements)
      ) {
        for (const replacement of recommendations.replacements) {
          const { day, mealType, oldMealId, newMealId, reason } = replacement;
          const dayIndex = dayNames.indexOf(day);
          const newMeal = availableMeals.find((m) => m.id === newMealId);
          if (dayIndex >= 0 && newMeal && newMeal.mealType === mealType) {
            await infoLog(
              `🤖 [MEAL-WORKFLOW] Applying optimization: Replace ${day} ${mealType} (ID ${oldMealId}) with ${newMeal.name} (ID ${newMealId}) - ${reason}`,
            );
            optimizedPlan.days = optimizedPlan.days.map((planDay) => {
              if (
                planDay.dayIndex === dayIndex &&
                planDay.mealType === mealType
              ) {
                return new MealPlanEntry({
                  dayIndex: planDay.dayIndex,
                  mealType: planDay.mealType,
                  meal: newMeal,
                });
              }
              return planDay;
            });
          }
        }
      }
    } catch (error) {
      await errorLog(
        `❌ [MEAL-WORKFLOW] Failed to parse LLM response: ${error}`,
      );
    }
    return new WeeklyMealPlan(optimizedPlan);
  }
  private formatPlanForPresentation(plan: GeneratedWeeklyMealPlan): string {
    const dayNames = DAYS_OF_THE_WEEK;
    const lines: string[] = [];
    lines.push('📅 Weekly Meal Plan:');
    lines.push('='.repeat(50));
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const dayMeals = plan.days.filter((d) => d.dayIndex === dayIndex);
      if (dayMeals.length > 0) {
        lines.push(`\n${dayNames[dayIndex]}:`);
        for (const dayMeal of dayMeals) {
          if (!dayMeal.meal) {
            lines.push(`  ${dayMeal.mealType}: (no meal)`);
            continue;
          }
          const effort = '🔥'.repeat(dayMeal.meal.effort);
          const redMeat = dayMeal.meal.hasRedMeat ? '🥩' : '';
          lines.push(
            `  ${dayMeal.mealType}: ${dayMeal.meal.name} ${effort} ${redMeat}`,
          );
        }
      }
    }
    return lines.join('\n');
  }
}
