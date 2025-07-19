import { infoLog, warnLog, errorLog } from '../logging';
import { ChatOpenAI } from '@langchain/openai';
import { FakeChatModel } from '@langchain/core/utils/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  WeeklyMealPlan as GeneratedWeeklyMealPlan,
  Meal as GeneratedMeal,
  ShoppingListItem,
  ShoppingList,
  Message,
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
import { HttpCheckpointSaver } from '../shared/httpCheckpointer';
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
import { getBackendClient } from '../utils/getBackendClient';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
const DEBUG_LOGS = false;

// Helper function to find repo root
function findRepoRoot(): string {
  let currentDir = process.cwd();

  // If we're in a compiled version, start from the actual source location
  if (currentDir.includes('/dist/')) {
    currentDir = dirname(dirname(currentDir));
  }

  while (currentDir !== '/') {
    if (existsSync(join(currentDir, 'package.json')) && existsSync(join(currentDir, '.git'))) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }

  // Fallback: assume we're already in the repo root
  return process.cwd();
}

/**
 * Meal planning workflow
 */
export class MealPlanningWorkflow implements BaseWorkflow {
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
    updates: Partial<MealPlanningState>
  ): MealPlanningState {
    return new MealPlanningCheckpointState({
      ...currentState,
      ...updates,
      updatedAt: Timestamp.fromDate(new Date()),
    });
  }

  /**
   * Add a message to the messages table via HTTP
   */
  private async addMessage(threadId: string, sender: string, message: string): Promise<void> {
    try {
      await getBackendClient().addMessage({
        threadId,
        sender,
        message,
      });

      debugLog(`[MESSAGE] Added ${sender} message to thread ${threadId}`);
    } catch (err) {
      warnLog(`⚠️ [MESSAGE] Failed to add ${sender} message: ${err}`);
      // Don't throw - message persistence shouldn't break the workflow
    }
  }

  /**
   * Get messages from the messages table via HTTP
   */
  private async getMessages(threadId: string): Promise<string[]> {
    try {
      const messages = await getBackendClient().getMessages({
        threadId,
      });

      // Filter for user messages and extract just the message content
      const userMessages = messages.messages
        .filter((msg: any) => msg.sender === 'user')
        .map((msg: any) => msg.content || msg.message || '')
        .filter((content: string) => content.trim().length > 0);

      debugLog(`[MESSAGE] Retrieved ${userMessages.length} user messages from thread ${threadId}`);
      return userMessages;
    } catch (err) {
      warnLog(`⚠️ [MESSAGE] Failed to get messages: ${err}`);
      return []; // Return empty array on error
    }
  }

  /**
   * Convert any Meal.lastPlanned that is not already a Date into a Date so
   * that WeeklyMealPlan.toJSON() can safely call toISOString().
   */
  private coerceDates(plan: WeeklyMealPlan | undefined): void {
    if (!plan?.days) return;
    for (const entry of plan.days) {
      const meal = entry.meal;
      if (!meal) continue;
      delete meal.lastPlanned;
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
  private checkpointer: HttpCheckpointSaver;
  private feedbackHandler: FeedbackHandler;

  constructor(checkpointer: HttpCheckpointSaver) {
    this.checkpointer = checkpointer;
    this.feedbackHandler = new FeedbackHandler(checkpointer);
    this.client = new Client({
      name: 'meal-planner-workflow',
      version: '1.0.0',
    });

    // Create workflow graph
    this.graph = this.createGraph();
  }

  private async saveCheckpoint(
    config: ExtendedRunnableConfig,
    state: MealPlanningState,
  ): Promise<void> {
    infoLog('MealPlanningWorkflow.saveCheckpoint called');
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

    infoLog(
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
            infoLog(
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

  async initialize(): Promise<void> {
    infoLog('MealPlanningWorkflow.initialize called');
    const isCodex = process.argv.includes('--codex');

    // Connect to MCP server
    // Always connect to the already-running MCP server (launched independently by yarn start:grpc)
    // No longer launch MCP server as child process since agent is now a long-running service
    infoLog(`🍽️ [MEAL-WORKFLOW] Starting to initialize meal planning workflow`);

    const transport = new StdioClientTransport({
      command: 'node',
      args: [
        join(findRepoRoot(), 'typescript/mcp/dist/index.js'),
      ],
    });

    await this.client.connect(transport);

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

    infoLog(`🍽️ [MEAL-WORKFLOW] Initialized meal planning workflow`);
  }

  async cleanup(): Promise<void> {
    infoLog('MealPlanningWorkflow.cleanup called');
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
        debugger;
        infoLog('MealPlanningWorkflow.invoke called');
        infoLog(`${`🍽️ [MEAL-WORKFLOW] Invoking workflow; input:`} ${input}`);
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
          const initiateResult = await this.initiateNode(state);
          infoLog(`Debuggyz - Initiated the workflow. Current Step: ${initiateResult.currentStep}`)
          state = this.updateState(state, initiateResult);
          await this.saveCheckpoint(config, state);
          infoLog(`Debuggyz - After updating state. Current Step: ${state.currentStep}`)

          const generateResult = await this.generatePlanNode(state);
          infoLog(`Debuggyz - Generated the plan. Current Step: ${generateResult.currentStep}`)
          state = this.updateState(state, generateResult);
          await this.saveCheckpoint(config, state);
          infoLog(`Debuggyz - After updating state. Current Step: ${state.currentStep}`)

          const optimizeResult = await this.optimizePlanNode(state);
          infoLog(`Debuggyz - Optimized the plan. ${optimizeResult.currentStep}`)
          state = this.updateState(state, optimizeResult);
          await this.saveCheckpoint(config, state);
          infoLog(`Debuggyz - After updating state. Current Step: ${state.currentStep}`)

          const presentResult = await this.presentPlanNode(state);
          infoLog(`Debuggyz - Presenting the plan. Current Step: ${optimizeResult.currentStep}`)

          state = this.updateState(state, presentResult);
          await this.saveCheckpoint(config, state);
          infoLog(`Debuggyz - After updating state. Current Step: ${state.currentStep}`)

          // Pause: checkpoint state
          // Debug: log the final state before saving checkpoint
          infoLog(
            `🔍 [WORKFLOW] Final state before checkpoint: current_step=${state.currentStep}`,
          );
          infoLog(
            `${`🔍 [WORKFLOW] Full state:`} ${JSON.stringify(state, null, 2)}`,
          );
          await this.saveCheckpoint(config, state);
          infoLog(
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

            this.coerceDates(checkpoint.state.mealPlan);
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
          infoLog(
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
            const allFeedback = await getBackendClient().getMessages({
              threadId: state.threadId
            })
            // Add a small buffer (5 seconds) to handle race conditions between message creation and workflow updates
            const lastUpdateWithBuffer = new Date(lastUpdate.getTime() - 5000);
            const newFeedback = allFeedback.messages.filter((f) =>
              f.createdAt ? new Date(f.createdAt) > lastUpdateWithBuffer : true,
            );

            infoLog("New feedback?", { newFeedbackLength: newFeedback.length.toString(), allFeedbackLength: allFeedback.messages.length.toString() });
            // 2. Analyze feedback to determine user satisfaction
            let analyzeResult = { satisfied: false, reasoning: '' };
            if (newFeedback.length > 0) {
              analyzeResult = await this.analyzeFeedbackNode(newFeedback);
            }

            // 3. If satisfied, finalize plan and break loop
            if (analyzeResult.satisfied) {
              state = this.updateState(state, {
                currentStep: MealPlanningStep.FINALIZE_PLAN
              });
              feedbackSatisfied = true;
              break;
            }

            // 4. If there is new feedback and not satisfied, apply it
            if (newFeedback.length > 0) {
              // Apply feedback via LLM
              const stateWithFeedback = Object.assign(state, { feedback_to_apply: newFeedback });
              const feedbackResult = await this.applyFeedbackNode(stateWithFeedback);
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
              infoLog(
                `🔍 [FINAL-CHECKPOINT] About to save final checkpoint with mealPlan: ${state.mealPlan ? 'EXISTS' : 'NULL/UNDEFINED'}`,
              );
              if (state.mealPlan) {
                infoLog(
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
          infoLog(`🔍 [WORKFLOW] Finalizing plan for thread ${config.configurable?.threadId}`);
          // Finalize, generate shopping list, complete
          const finalizeResult = await this.finalizePlanNode(state);
          state = this.updateState(state, finalizeResult);
          infoLog(`🔍 [WORKFLOW] Generating shopping list for thread ${config.configurable?.threadId}`);
          const shoppingResult = await this.generateShoppingListNode(state);
          infoLog(`🔍 [WORKFLOW] Generated shopping list for thread ${config.configurable?.threadId}`);
          state = this.updateState(state, shoppingResult);
          infoLog(`🔍 [WORKFLOW] Completed workflow for thread ${config.configurable?.threadId}`);
          const completeResult = await this.completeNode(state);
          state = this.updateState(state, completeResult);
          return state;
        }
      },
    };
  }

  // Node implementations
  private async initiateNode(
    state: MealPlanningState,
  ): Promise<Partial<MealPlanningState>> {
    infoLog('MealPlanningWorkflow.initiateNode called');
    infoLog(
      `🍽️ [MEAL-WORKFLOW] Initiating meal planning for thread ${state.threadId}`,
    );

    return {
      currentStep: MealPlanningStep.GENERATE_PLAN,
    };
  }

  private async generatePlanNode(
    _state: MealPlanningState,
  ): Promise<Partial<MealPlanningState>> {
    infoLog('MealPlanningWorkflow.generatePlanNode called');
    const reqId = uuidv4();
    infoLog(`🍽️ [MEAL-WORKFLOW] Generating initial meal plan: ${reqId}`);

    try {
      // Generate meal plan using MCP tool
      await infoLog(`🔧 [MCP-INPUT] About to call generateMealPlan with arguments: {}`);
      await infoLog(`🔧 [MCP-INPUT] MCP client state: ${this.client ? 'EXISTS' : 'NULL'}`);
      
      const planResult = await this.client.callTool({
        name: 'generateMealPlan',
        arguments: {},
      });
      const planResultString = JSON.stringify(planResult);
      await infoLog(`PLAN RESULT FROM MCP: ${reqId}`);
      await infoLog(`🔧 [MCP-OUTPUT] Full MCP response: ${planResultString}`);
      await debugLog(planResultString);

      // Validate MCP response and guard against missing content
      if ((planResult as MCPToolResultType).isError) {
        const errorContent =
          Array.isArray((planResult as MCPToolResultType).content) &&
            (planResult as MCPToolResultType).content[0]?.type === 'text'
            ? (planResult as MCPToolResultType).content[0].text
            : 'Unknown error';
        throw new Error(`MCP tool error: ${errorContent}`);
      }

      const responseText =
        Array.isArray((planResult as MCPToolResultType).content) &&
          (planResult as MCPToolResultType).content[0]?.type === 'text'
          ? (planResult as MCPToolResultType).content[0].text
          : '{}';

      const jsonText = this.extractJsonFromResponse(responseText);
      const generateResponse = JSON.parse(jsonText);

      await infoLog(`MEAL PLAN from generate------- req: ${reqId}`);
      await infoLog(JSON.stringify(generateResponse, null, 2));

      // DEBUGGING: Log dayIndex values BEFORE fromJson conversion
      await infoLog(
        '🔍 [AGENT] dayIndex values BEFORE WeeklyMealPlan.fromJson:',
      );
      if (generateResponse.plan?.days) {
        for (let i = 0; i < generateResponse.plan.days.length; i++) {
          const day = generateResponse.plan.days[i];
          await infoLog(
            `🔍 [AGENT] BEFORE Entry ${i}: dayIndex=${day.dayIndex}, mealType=${day.mealType}, meal=${day.meal?.name || 'nil'}`,
          );
        }
      }

      const mealPlan = WeeklyMealPlan.fromJson(generateResponse.plan);

      // DEBUGGING: Log dayIndex values AFTER fromJson conversion
      await infoLog(
        '🔍 [AGENT] dayIndex values AFTER WeeklyMealPlan.fromJson:',
      );
      if (mealPlan.days) {
        for (let i = 0; i < mealPlan.days.length; i++) {
          const day = mealPlan.days[i];
          await infoLog(
            `🔍 [AGENT] AFTER Entry ${i}: dayIndex=${day.dayIndex}, mealType=${day.mealType}, meal=${day.meal?.name || 'nil'}`,
          );
        }
      }

      return {
        currentStep: MealPlanningStep.OPTIMIZE_PLAN,
        mealPlan: mealPlan,
      };
    } catch (error) {
      errorLog(`${` [MEAL-WORKFLOW] Error generating plan:`} ${error}`);
      throw error;
    }
  }

  private async optimizePlanNode(
    state: MealPlanningState,
  ): Promise<Partial<MealPlanningState>> {
    infoLog('MealPlanningWorkflow.optimizePlanNode called');
    infoLog(
      `🍽️ [MEAL-WORKFLOW] Optimizing meal plan (iteration ${state.iterationCount + 1})`,
    );

    if (!state.mealPlan) {
      throw new Error('No meal plan to optimize');
    }

    const issues = this.validatePlan(state.mealPlan);
    let optimizedPlan = state.mealPlan;

    if (issues.length > 0) {
      infoLog(
        `${`📋 [MEAL-WORKFLOW] Found ${issues.length} issues:`} ${issues}`,
      );
      optimizedPlan = await this.optimizePlanWithLLM(state.mealPlan, issues);
    } else {
      infoLog(`✅ [MEAL-WORKFLOW] Plan is already valid`);
    }

    return {
      currentStep: MealPlanningStep.PRESENT_PLAN,
      mealPlan: optimizedPlan,
      iterationCount: state.iterationCount + 1,
    };
  }

  // New: apply feedback using LLM with feedback context
  private async applyFeedbackNode(
    state: MealPlanningState & { feedback_to_apply?: Message[] },
  ): Promise<Partial<MealPlanningState>> {
    infoLog('MealPlanningWorkflow.applyFeedbackNode called');
    infoLog(`🍽️ [MEAL-WORKFLOW] Applying user feedback via LLM`);
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
  private async analyzeFeedbackNode(
    feedbackEntries: Message[],
  ): Promise<{ satisfied: boolean; reasoning: string }> {
    infoLog('MealPlanningWorkflow.analyzeFeedbackNode called');
    const latestFeedback = feedbackEntries[feedbackEntries.length - 1];
    infoLog(`🍽️ [MEAL-WORKFLOW] Analyzing feedback: ${latestFeedback.content}`);
    const prompt = getAnalyzeFeedbackPrompt(latestFeedback.content);
    const result = await this.nanoLlm.invoke([
      { role: 'user', content: prompt },
    ]);
    infoLog(`🍽️ [MEAL-WORKFLOW] Analyzed feedback: ${result.content}`);
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
      errorLog(
        `❌ [MEAL-WORKFLOW] Failed to parse feedback analysis response: ${err}`,
      );
    }
    return analysis;
  }

  private async applyFeedbackWithLLM(
    plan: GeneratedWeeklyMealPlan,
    feedback: string[],
  ): Promise<{ mealPlan: GeneratedWeeklyMealPlan; userMessage: string }> {
    infoLog('MealPlanningWorkflow.applyFeedbackWithLLM called');
    const t0 = Date.now();
    debugLog(
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
    infoLog(`🤖 [MEAL-WORKFLOW] Calling into the LLM`);
    const result = await this.llm.invoke([{ role: 'user', content: prompt }]);
    const llmResponse =
      typeof result.content === 'string'
        ? result.content
        : JSON.stringify(result.content);

    infoLog(`🤖 [MEAL-WORKFLOW] Raw LLM response:`);
    infoLog(llmResponse);

    infoLog(
      `${`🤖 [MEAL-WORKFLOW] Feedback being processed:`} ${feedbackText}`,
    );
    // Create a proper WeeklyMealPlan object to preserve protobuf structure
    let updatedPlan: WeeklyMealPlan = plan;
    let userMessage = "I've updated your meal plan based on your feedback!"; // Default fallback message

    try {
      const cleanedResponse = this.extractJsonFromResponse(llmResponse);
      infoLog(`🤖 [MEAL-WORKFLOW] Cleaned JSON response:`);
      infoLog(cleanedResponse);
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
            infoLog(
              `🤖 [MEAL-WORKFLOW] Applying removal from the LLM: Remove ${day} ${mealType} - ${reason}`,
            );

            // Handle "all" mealType by removing each meal type individually
            const mealTypesToRemove =
              mealType === 'all'
                ? ['breakfast', 'lunch', 'dinner']
                : [mealType];

            // Apply all removals locally to avoid race conditions with multiple MCP calls
            for (const specificMealType of mealTypesToRemove) {
              infoLog(
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
            infoLog(
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
      errorLog(
        `❌ [MEAL-WORKFLOW] Failed to parse LLM feedback response: ${error}`,
      );
      userMessage =
        "I've made some adjustments to your meal plan based on your feedback."; // Fallback on error
    }
    debugLog(
      `[FEEDBACK] applyFeedbackWithLLM finished in ${Date.now() - t0}ms`,
    );
    return { mealPlan: updatedPlan, userMessage };
  }

  private async presentPlanNode(
    state: MealPlanningState,
  ): Promise<Partial<MealPlanningState>> {
    infoLog('MealPlanningWorkflow.presentPlanNode called');
    infoLog(`🍽️ [MEAL-WORKFLOW] Presenting meal plan to participants`);

    if (!state.mealPlan) {
      throw new Error('No meal plan to present');
    }

    // Format plan for presentation
    const planPresentation = this.formatPlanForPresentation(state.mealPlan);
    infoLog(`📋 [MEAL-PLAN]\n${planPresentation}`);

    // Check if we have recent feedback that requires processing

    return {
      currentStep: MealPlanningStep.AWAIT_FEEDBACK,
    };
  }

  private async finalizePlanNode(
    state: MealPlanningState,
  ): Promise<Partial<MealPlanningState>> {
    infoLog('MealPlanningWorkflow.finalizePlanNode called');
    infoLog(`🍽️ [MEAL-WORKFLOW] Finalizing meal plan`);

    if (!state.mealPlan) {
      throw new Error('No meal plan to finalize');
    }

    // Save the meal plan using MCP tool
    try {
      await this.client.callTool({
        name: 'finalizeMealPlan',
        arguments: { mealPlan: state.mealPlan },
      });

      infoLog(`✅ [MEAL-WORKFLOW] Meal plan saved successfully`);
    } catch (error) {
      warnLog(`${`⚠️ [MEAL-WORKFLOW] Could not save meal plan:`} ${error}`);
      // Continue anyway as this is not critical for the workflow
    }

    return {
      currentStep: MealPlanningStep.GENERATE_SHOPPING_LIST,
      isFinalized: true,
    };
  }

  private async generateShoppingListNode(
    state: MealPlanningState,
  ): Promise<Partial<MealPlanningState>> {
    infoLog('MealPlanningWorkflow.generateShoppingListNode called');
    infoLog(`🍽️ [MEAL-WORKFLOW] Generating shopping list`);

    if (!state.mealPlan) {
      throw new Error('No meal plan for shopping list generation');
    }

    try {
      // Extract meal IDs from the meal plan
      const mealIds = state.mealPlan.days
        .map((day) => day.meal?.id)
        .filter((id): id is number => id !== undefined)
        .filter((id, index, self) => self.indexOf(id) === index); // Deduplicate

      infoLog(
        `${`🛒 [MEAL-WORKFLOW] Generating shopping list for meal IDs:`} ${mealIds}`,
      );

      // Call the MCP tool directly with proper typing
      const result = (await this.client.callTool({
        name: 'generateShoppingList',
        arguments: { plan: mealIds },
      })) as MCPToolResultType;

      if (result.isError) {
        const errorContent =
          Array.isArray(result.content) && result.content[0]?.type === 'text'
            ? result.content[0].text
            : 'Unknown error';
        throw new Error(`MCP tool error: ${errorContent}`);
      }

      // Parse the response with proper type checking
      const responseText =
        Array.isArray(result.content) && result.content[0]?.type === 'text'
          ? result.content[0].text
          : '[]';

      if (DEBUG_LOGS) {
        infoLog(`🛒 [DEBUG] Raw shopping list response: ${responseText}`);
      }
      const shoppingList = JSON.parse(responseText) as ShoppingListResponse;
      if (DEBUG_LOGS) {
        infoLog(
          `🛒 [DEBUG] Parsed shopping list: ${JSON.stringify(shoppingList, null, 2)}`,
        );
      }

      infoLog(
        `✅ [MEAL-WORKFLOW] Generated shopping list with ${shoppingList.length} items`,
      );

      // Display the shopping list in a nice format
      infoLog('\n🛍️  SHOPPING LIST 🛒');
      infoLog('===================');

      if (!Array.isArray(shoppingList) || shoppingList.length === 0) {
        infoLog('\nNo items in shopping list');
        return {
          currentStep: MealPlanningStep.COMPLETE,
          shoppingList: undefined,
        };
      }
      let shoppingListFormatted = '';
      try {
        // Group items by category if available
        const groupedItems = shoppingList.reduce(
          (acc: Record<string, ShoppingListItem[]>, item: ShoppingListItem) => {
            if (!item || typeof item !== 'object') {
              warnLog(`Skipping invalid shopping list item: ${item}`);
              return acc;
            }

            const category =
              item.category && typeof item.category === 'string'
                ? item.category
                : 'Other';
            const ingredient =
              item.ingredient && typeof item.ingredient === 'string'
                ? item.ingredient
                : 'Unknown ingredient';
            const quantity =
              item.quantity && typeof item.quantity === 'string'
                ? item.quantity
                : '';

            if (!acc[category]) {
              acc[category] = [];
            }

            acc[category].push(
              ShoppingListItem.fromJson({ ingredient, quantity, category }),
            );

            return acc;
          },
          {},
        );

        // Format shopping list as a bulleted string (grouped by category)
        let bulletedList = '';
        for (const [category, items] of Object.entries(groupedItems)) {
          bulletedList += `\n${category.toUpperCase()}:\n`.trimStart();
          (items as ShoppingListItem[]).forEach((item) => {
            bulletedList += `- ${[item.quantity, item.ingredient].join(' ').trimStart()}\n`;
          });
        }
        bulletedList = bulletedList.trim();

        // Pantry staples prompt
        const PANTRY_STAPLES_CATEGORIZATION_PROMPT =
          getPantryStaplesCategorizationPrompt(bulletedList);

        try {
          infoLog(
            `\n🛒 [LLM FORMATTED SHOPPING LIST]: Asking LLM to categorize our list: ${bulletedList}...\n`,
          );
          const llmResult = await this.llm.invoke([
            { role: 'user', content: PANTRY_STAPLES_CATEGORIZATION_PROMPT },
          ]);
          shoppingListFormatted =
            typeof llmResult.content === 'string'
              ? llmResult.content
              : JSON.stringify(llmResult.content);
          infoLog(`
🛒 [LLM FORMATTED SHOPPING LIST]:
 ${shoppingListFormatted}`);
        } catch (llmError) {
          errorLog(
            `❌ Error calling LLM for pantry staples formatting: ${llmError}`,
          );
          shoppingListFormatted = bulletedList; // fallback
        }

        infoLog('\nHappy shopping! 🛒');
        infoLog('===================\n');
      } catch (error) {
        errorLog(`❌ Error formatting shopping list: ${error}`);
        // Fallback: display raw data if formatting fails
        infoLog('\nRaw shopping list data:');
        infoLog(JSON.stringify(shoppingList, null, 2));
      }

      return {
        currentStep: MealPlanningStep.COMPLETE,
        shoppingList: shoppingList ? new ShoppingList({ items: shoppingList }) : undefined,
      };
    } catch (error) {
      errorLog(
        `${`❌ [MEAL-WORKFLOW] Error generating shopping list:`} ${error}`,
      );
      // Continue with empty shopping list on error
      return {
        currentStep: MealPlanningStep.COMPLETE,
        shoppingList: undefined,
      };
    }
  }

  private async completeNode(
    state: MealPlanningState,
  ): Promise<Partial<MealPlanningState>> {
    infoLog('MealPlanningWorkflow.completeNode called');
    infoLog(`🍽️ [MEAL-WORKFLOW] Meal planning workflow completed`);

    // Final validation
    const finalIssues = state.mealPlan
      ? this.validatePlan(state.mealPlan)
      : [];
    if (finalIssues.length > 0) {
      warnLog(`${`⚠️ [MEAL-WORKFLOW] Final plan has issues:`} ${finalIssues}`);
    }

    return {
      currentStep: MealPlanningStep.COMPLETE,
    };
  }

  private validatePlan(plan: GeneratedWeeklyMealPlan): string[] {
    infoLog('MealPlanningWorkflow.validatePlan called');
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
    infoLog('MealPlanningWorkflow.optimizePlanWithLLM called');
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
            infoLog(
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
      errorLog(`❌ [MEAL-WORKFLOW] Failed to parse LLM response: ${error}`);
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
