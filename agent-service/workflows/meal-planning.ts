import { infoLog, warnLog } from '../logging';
import { ChatOpenAI } from '@langchain/openai';
import { FakeChatModel } from '@langchain/core/utils/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { WeeklyMealPlan as GeneratedWeeklyMealPlan, Meal as GeneratedMeal } from '@mealplanner/generated';
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
import { saveCheckpoint as saveCheckpointExternal } from './meal-planning/persistence.js';
import { cloneAndUpdateState, deserializeMealPlanFromCheckpoint } from './meal-planning/state.js';
import { DbCheckpointSaver } from '../shared/dbCheckpointer';
import { FeedbackHandler } from './feedback-handler';
import { MCPToolResult as MCPToolResultType } from '../shared/mcp-types';
import { DAYS_OF_THE_WEEK } from '../shared/days';
import type { DayOfTheWeek } from '../shared/days';
import { getUpdateMealPlanPrompt, getOptimizeMealPlanPrompt } from './meal-planning-prompts';
import { v4 as uuidv4 } from 'uuid';
import { MessageRepository } from '../database/messages';
// Extracted node imports (keep imports at top of file)
import { initiateNode as initiateNodeExternal } from './meal-planning/nodes/initiate.js';
import { generatePlanNode as generatePlanNodeExternal } from './meal-planning/nodes/generatePlan.js';
import { presentPlanNode as presentPlanNodeExternal } from './meal-planning/nodes/presentPlan.js';
import { optimizePlanNode as optimizePlanNodeExternal } from './meal-planning/nodes/optimizePlan.js';
import { finalizePlanNode as finalizePlanNodeExternal } from './meal-planning/nodes/finalizePlan.js';
import { generateShoppingListNode as generateShoppingListNodeExternal } from './meal-planning/nodes/generateShoppingList.js';
import { analyzeFeedbackNode as analyzeFeedbackNodeExternal } from './meal-planning/nodes/feedback/analyze.js';
import { applyFeedbackNode as applyFeedbackNodeExternal } from './meal-planning/nodes/feedback/apply.js';
// const DEBUG_LOGS = false;
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
   * Type guards for parsed LLM recommendation payloads
   */
  private isObjectRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null;
  }
  private isDayOfTheWeek(v: unknown): v is DayOfTheWeek {
    return typeof v === 'string' && (DAYS_OF_THE_WEEK as readonly string[]).includes(v);
  }
  private isMealType(v: unknown): v is 'breakfast' | 'lunch' | 'dinner' {
    return v === 'breakfast' || v === 'lunch' || v === 'dinner';
  }
  private isMealTypeOrAll(v: unknown): v is 'breakfast' | 'lunch' | 'dinner' | 'all' {
    return this.isMealType(v) || v === 'all';
  }

  private isRemoval(v: unknown): v is { day: DayOfTheWeek; mealType: 'breakfast' | 'lunch' | 'dinner' | 'all'; reason?: string } {
    if (!this.isObjectRecord(v)) return false;
    const day = (v).day;
    const mealType = (v).mealType;
    const reason = (v).reason;
    return this.isDayOfTheWeek(day) && this.isMealTypeOrAll(mealType) && (reason === undefined || typeof reason === 'string');
  }

  private isReplacement(v: unknown): v is { day: DayOfTheWeek; mealType: 'breakfast' | 'lunch' | 'dinner'; oldMealId?: number; newMealId: number; reason?: string } {
    if (!this.isObjectRecord(v)) return false;
    const day = (v).day;
    const mealType = (v).mealType;
    const oldMealId = (v).oldMealId;
    const newMealId = (v).newMealId;
    const reason = (v).reason;
    const oldOk = oldMealId === undefined || typeof oldMealId === 'number';
    return (
      this.isDayOfTheWeek(day) &&
      this.isMealType(mealType) &&
      oldOk &&
      typeof newMealId === 'number' &&
      (reason === undefined || typeof reason === 'string')
    );
  }
  private isRecommendations(v: unknown): v is {
    userMessage?: string;
    removals?: Array<{ day: DayOfTheWeek; mealType: 'breakfast' | 'lunch' | 'dinner' | 'all'; reason?: string }>;
    replacements?: Array<{ day: DayOfTheWeek; mealType: 'breakfast' | 'lunch' | 'dinner'; oldMealId?: number; newMealId: number; reason?: string }>;
  } {
    if (!this.isObjectRecord(v)) return false;
    const obj = v;
    const um = obj.userMessage;
    if (um !== undefined && typeof um !== 'string') return false;
    const rem = obj.removals;
    if (rem !== undefined) {
      if (!Array.isArray(rem)) return false;
      if (!rem.every((r) => this.isRemoval(r))) return false;
    }
    const rep = obj.replacements;
    if (rep !== undefined) {
      if (!Array.isArray(rep)) return false;
      if (!rep.every((r) => this.isReplacement(r))) return false;
    }
    return true;
  }
  /**
   * Helper to update proto state with partial updates
   */
  // Removed updateState; use cloneAndUpdateState from ./meal-planning/state
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
    } catch {
      // Do not throw; message persistence should not break workflow
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
    } catch {
      return [];
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
    // Mark compatibility methods as used to satisfy TS noUnusedLocals in build
    this.__keepReferences();
  }
  // Keep reference to optional method used in some code paths to satisfy TS build
  private __keepReferences(): void {
    void this.formatPlanForPresentation;
  }
  private async saveCheckpoint(
    config: ExtendedRunnableConfig,
    state: MealPlanningState,
  ): Promise<void> {
    await saveCheckpointExternal(this.checkpointer, config, state);
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
    await this.client.close();
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
          `${`🍽️ [MEAL-WORKFLOW] Invoking workflow; input:`} ${String(input)}`,
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
          state = cloneAndUpdateState(state, initiateResult);
          await this.saveCheckpoint(config, state);
          await infoLog(
            `Debuggyz - After updating state. Current Step: ${state.currentStep}`,
          );
          const callToolForGeneratePlan = async (
            args: { name: string; arguments: Record<string, unknown> },
          ): Promise<{ isError?: boolean; content?: unknown }> => {
            const res = (await this.client.callTool(args)) as MCPToolResultType;
            return { isError: res.isError, content: res.content as unknown };
          };
          const generateResult = await generatePlanNodeExternal(state, {
            callTool: callToolForGeneratePlan,
            extractJsonFromResponse: (s: string) => this.extractJsonFromResponse(s),
          });
          await infoLog(
            `Debuggyz - Generated the plan. Current Step: ${generateResult.currentStep}`,
          );
          state = cloneAndUpdateState(state, generateResult);
          await this.saveCheckpoint(config, state);
          await infoLog(
            `Debuggyz - After updating state. Current Step: ${state.currentStep}`,
          );
          const optimizeResult = await optimizePlanNodeExternal(state, {
            validatePlan: (p) => this.validatePlan(p),
            optimizePlanWithLLM: (p, issues) => this.optimizePlanWithLLM(p, issues),
          });
          await infoLog(
            `Debuggyz - Optimized the plan. ${optimizeResult.currentStep}`,
          );
          state = cloneAndUpdateState(state, optimizeResult);
          await this.saveCheckpoint(config, state);
          await infoLog(
            `Debuggyz - After updating state. Current Step: ${state.currentStep}`,
          );
          const presentResult = await presentPlanNodeExternal(state);
          await infoLog(
            `Debuggyz - Presenting the plan. Current Step: ${optimizeResult.currentStep}`,
          );
          state = cloneAndUpdateState(state, presentResult);
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
          state = deserializeMealPlanFromCheckpoint(checkpoint.state);
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
            let allFeedback: Array<{ created_at?: string } & Record<string, unknown>> = [];
            allFeedback = await this.messageRepo.getMessagesForProtobuf(
              state.threadId,
            );
            // Add a small buffer (5 seconds) to handle race conditions between message creation and workflow updates
            const lastUpdateWithBuffer = new Date(lastUpdate.getTime() - 5000);
            const newFeedback = allFeedback.filter((f) =>
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
              analyzeResult = await analyzeFeedbackNodeExternal(newFeedback, {
                nanoLlm: this.nanoLlm,
                extractJsonFromResponse: (s: string) => this.extractJsonFromResponse(s),
              });
            }
            // 3. If satisfied, finalize plan and break loop
            if (analyzeResult.satisfied) {
              state = cloneAndUpdateState(state, {
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
              const feedbackResult = await applyFeedbackNodeExternal(stateWithFeedback, {
                getMessages: (threadId: string) => this.getMessages(threadId),
                applyFeedbackWithLLM: (
                  plan: GeneratedWeeklyMealPlan,
                  messages: string[],
                ) => this.applyFeedbackWithLLM(plan, messages),
                addMessage: (threadId: string, sender: string, message: string) =>
                  this.addMessage(threadId, sender, message),
              });
              state = cloneAndUpdateState(state, feedbackResult);
              // Feedback applied - continue processing
              const optimizeResult = await optimizePlanNodeExternal(state, {
                validatePlan: (p) => this.validatePlan(p),
                optimizePlanWithLLM: (p, issues) => this.optimizePlanWithLLM(p, issues),
              });
              state = cloneAndUpdateState(state, optimizeResult);
              await this.saveCheckpoint(config, state);
            }
            // 5. Present the plan after feedback is processed/applied
            const presentResult = await presentPlanNodeExternal(state);
            state = cloneAndUpdateState(state, presentResult);
            await this.saveCheckpoint(config, state);
            // 6. Pause for feedback after presenting the plan
            if (state.currentStep === MealPlanningStep.AWAIT_FEEDBACK) {
              // Create properly typed checkpoint
              // DEBUGGING: Log meal plan before checkpoint serialization (feedback loop)
              if (state.mealPlan) {
                await infoLog(
                  '🔍 [CHECKPOINT-SAVE-FEEDBACK] mealPlan before checkpoint serialization:',
                );
                if (Array.isArray(state.mealPlan.days)) {
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
                  `🔍 [FINAL-CHECKPOINT] meal_plan has ${state.mealPlan.days.length} days`,
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
          const finalizeResult = await finalizePlanNodeExternal(state, {
            callTool: (args) => this.client.callTool(args),
          });
          state = cloneAndUpdateState(state, finalizeResult);
          await infoLog(
            `🔍 [WORKFLOW] Generating shopping list for thread ${config.configurable?.threadId}`,
          );
          const callToolForShoppingList = async (
            args: { name: string; arguments: Record<string, unknown> },
          ): Promise<{ isError?: boolean; content?: Array<{ type?: string; text?: string }> | unknown }> => {
            const res = (await this.client.callTool(args)) as MCPToolResultType;
            return { isError: res.isError, content: res.content };
          };
          const shoppingResult = await generateShoppingListNodeExternal(state, {
            callTool: callToolForShoppingList,
          });
          await infoLog(
            `🔍 [WORKFLOW] Generated shopping list for thread ${config.configurable?.threadId}`,
          );
          state = cloneAndUpdateState(state, shoppingResult);
          await infoLog(
            `🔍 [WORKFLOW] Completed workflow for thread ${config.configurable?.threadId}`,
          );
          const completeResult = await this.completeNode(state);
          state = cloneAndUpdateState(state, completeResult);
          return state;
        }
      },
    };
  }
  // Compatibility wrappers for tests that call internal node methods
  async finalizePlanNode(state: MealPlanningState): Promise<Partial<MealPlanningState>> {
    return finalizePlanNodeExternal(state, {
      callTool: (args) => this.client.callTool(args),
    });
  }
  async generateShoppingListNode(state: MealPlanningState): Promise<Partial<MealPlanningState>> {
    return generateShoppingListNodeExternal(state, {
      callTool: async (args) => {
        const res = (await this.client.callTool(args)) as MCPToolResultType;
        return { isError: res.isError, content: res.content } as any;
      },
    });
  }
  async optimizePlanNode(state: MealPlanningState): Promise<Partial<MealPlanningState>> {
    if (!state.mealPlan) {
      throw new Error('No meal plan to optimize');
    }
    const issues = this.validatePlan(state.mealPlan);
    const newPlan = issues.length > 0 ? await this.optimizePlanWithLLM(state.mealPlan, issues) : state.mealPlan;
    return {
      currentStep: MealPlanningStep.PRESENT_PLAN,
      mealPlan: newPlan,
      iterationCount: (state.iterationCount ?? 0) + 1,
    };
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
    const mealsText = (mealsResp as MCPToolResultType).content[0]?.text ?? '[]';
    const availableMeals: GeneratedMeal[] = JSON.parse(
      this.extractJsonFromResponse(mealsText),
    ) as unknown as GeneratedMeal[];
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
    const updatedPlan: WeeklyMealPlan = plan;
    let userMessage = "I've updated your meal plan based on your feedback!"; // Default fallback message
    const cleanedResponse = this.extractJsonFromResponse(llmResponse);
    await infoLog(`🤖 [MEAL-WORKFLOW] Cleaned JSON response:`);
    await infoLog(cleanedResponse);
    const parsed: unknown = JSON.parse(cleanedResponse);
    if (!this.isRecommendations(parsed)) {
      throw new Error('Invalid recommendation payload shape');
    }
    const recommendations = parsed;
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
    await debugLog(
      `[FEEDBACK] applyFeedbackWithLLM finished in ${Date.now() - t0}ms`,
    );
    return { mealPlan: updatedPlan, userMessage };
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // removed legacy wrapper presentPlanNode
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // removed legacy wrapper finalizePlanNode
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // removed legacy wrapper generateShoppingListNode
  private async completeNode(
    state: MealPlanningState,
  ): Promise<Partial<MealPlanningState>> {
    await infoLog('MealPlanningWorkflow.completeNode called');
    await infoLog(`🍽️ [MEAL-WORKFLOW] Meal planning workflow completed`);
    // Final validation
    const finalIssues = state.mealPlan ? this.validatePlan(state.mealPlan) : [];
    if (finalIssues.length > 0) {
      await warnLog(
        `${`⚠️ [MEAL-WORKFLOW] Final plan has issues:`} ${finalIssues.join(', ')}`,
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
    const optMealsText = (mealsResp as MCPToolResultType).content[0]?.text ?? '[]';
    const availableMeals: GeneratedMeal[] = JSON.parse(optMealsText) as unknown as GeneratedMeal[];
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
    const optimizedPlan = { ...plan, days: [...plan.days] };
    const parsed: unknown = JSON.parse(
      this.extractJsonFromResponse(llmResponse),
    );
    if (!this.isRecommendations(parsed)) {
      throw new Error('Invalid recommendation payload shape');
    }
    const recommendations = parsed;
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
    return new WeeklyMealPlan(optimizedPlan);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
