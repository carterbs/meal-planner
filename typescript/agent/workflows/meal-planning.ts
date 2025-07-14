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
  FeedbackEntryProto,
} from '@mealplanner/generated';
import type { ExtendedRunnableConfig } from '../shared/types';
import {
  WeeklyMealPlan,
  AgentCheckpoint,
  AgentCheckpointMetadata,
  SaveMealPlanRequest,
  MealPlanEntry,
} from '@mealplanner/generated';
import { MealPlanningCheckpointState } from '@mealplanner/generated';
import { Timestamp } from '@bufbuild/protobuf';

import {
  MealPlanningState,
  MealPlanningStep,
  WorkflowType,
  VALIDATION_CRITERIA,
  FeedbackEntry,
} from '../shared/types';
import { BaseWorkflow } from '../registry';
import { debugLog } from '../cli';
import { HttpCheckpointSaver } from '../shared/httpCheckpointer';
import { FeedbackHandler } from './feedback-handler';
import {
  ShoppingListResponse,
  MCPToolResult as MCPToolResultType,
} from '../shared/mcp-types';

import { DAYS_OF_THE_WEEK } from '@meal-planner/shared';
import {
  getAnalyzeFeedbackPrompt,
  getUpdateMealPlanPrompt,
  getOptimizeMealPlanPrompt,
  getPantryStaplesCategorizationPrompt,
} from './meal-planning-prompts';
import { debug } from 'console';
import { v4 as uuidv4 } from 'uuid';
const DEBUG_LOGS = false;

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
   * Convert any Meal.lastPlanned that is not already a Date into a Date so
   * that WeeklyMealPlan.toJSON() can safely call toISOString().
   */
  private coerceDates(plan: WeeklyMealPlan | undefined): void {
    if (!plan?.days) return;
    for (const entry of plan.days) {
      const meal = entry.meal;
      if (!meal) continue;
      // Always remove lastPlanned to avoid protobuf serialization issues
      delete meal.lastPlanned;
      if ((meal as unknown as Record<string, unknown>)['last_planned']) {
        delete (meal as unknown as Record<string, unknown>)['last_planned'];
      }
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
    this.saveMealPlan = this.saveMealPlan.bind(this);
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
    if (state.meal_plan) {
      await infoLog(
        '🔍 [SAVE-CHECKPOINT] mealPlan before checkpoint serialization:',
      );
      if (state.meal_plan.days) {
        for (let i = 0; i < state.meal_plan.days.length; i++) {
          const day = state.meal_plan.days[i];
          await infoLog(
            `🔍 [SAVE-CHECKPOINT] Entry ${i}: dayIndex=${day.dayIndex}, mealType=${day.mealType}, meal=${day.meal?.name || 'nil'}`,
          );
        }
      }
    }

    // Deep copy and coerce dates before serialization to avoid modifying original state
    let cleanMealPlan = undefined;
    if (state.meal_plan) {
      try {
        // Create a deep copy to avoid modifying original state
        cleanMealPlan = JSON.parse(JSON.stringify(state.meal_plan));

        // DEBUGGING: Check meal plan structure before coercing dates
        infoLog('🔍 [SAVE-CHECKPOINT] cleanMealPlan after JSON.parse:');
        if (cleanMealPlan.days) {
          for (let i = 0; i < cleanMealPlan.days.length && i < 5; i++) {
            const day = cleanMealPlan.days[i];
            infoLog(
              `🔍 [SAVE-CHECKPOINT] cleanMealPlan Entry ${i}: dayIndex=${day.dayIndex}, mealType=${day.mealType}, meal=${day.meal?.name || 'nil'}`,
            );
          }
        }

        this.coerceDates(cleanMealPlan);
      } catch (e) {
        infoLog(`Failed to clean meal plan for checkpoint: ${e}`);
        cleanMealPlan = undefined; // Skip meal plan if cleaning fails
      }
    }

    const protoState = new MealPlanningCheckpointState({
      threadId: state.threadId,
      participants: state.participants,
      createdAt: Timestamp.fromDate(new Date(state.created_at)),
      updatedAt: Timestamp.fromDate(new Date(state.updated_at)),
      currentStep: state.current_step,
      mealPlan: cleanMealPlan,
      feedbackHistory: state.feedback_history.map((entry) => new FeedbackEntryProto({
        from: entry.from,
        message: entry.message,
        timestamp: Timestamp.fromDate(entry.timestamp),
        mealPlanVersion: entry.meal_plan_version,
      })),
      iterationCount: state.iteration_count,
      shoppingList: state.shopping_list ? new ShoppingList({ items: state.shopping_list }) : undefined,
      isFinalized: state.is_finalized,
    });
    infoLog(
      `🔍 [SAVE-CHECKPOINT] mealPlan before protoState serialization: ${JSON.stringify(protoState)}`,
    );
    let checkpoint: AgentCheckpoint;
    try {
      checkpoint = new AgentCheckpoint({
        state: protoState,
        messages: [],
        next: [],
        step: 0,
      });
    } catch (e) {
      // log every lastPlanned value
      if (state.meal_plan) {
        for (const day of state.meal_plan.days) {
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
    const isJsonMode = process.argv.includes('--json');

    // Connect to MCP server
    // In JSON mode (API calls), assume MCP server is already running and connect to it directly
    // Otherwise, start the full server stack
    infoLog(`🍽️ [MEAL-WORKFLOW] Starting to initialize meal planning workflow`);

    const transport = new StdioClientTransport({
      command: 'node',
      args: isJsonMode
        ? [
            '/Users/bradcarter/Documents/Dev/meal-planner/typescript/mcp/dist/index.js',
          ]
        : [
            '/Users/bradcarter/Documents/Dev/meal-planner/scripts/start-mcp.js',
            isCodex ? '--codex' : '',
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
        infoLog('MealPlanningWorkflow.invoke called');
        infoLog(`${`🍽️ [MEAL-WORKFLOW] Invoking workflow; input:`} ${input}`);
        // Load checkpoint
        const tuple = await this.checkpointer.getTuple(config);
        let state: MealPlanningState;
        if (!tuple) {
          // Initial run
          state = {
            threadId: config.configurable?.threadId ?? uuidv4(),
            workflow_type: WorkflowType.MEAL_PLANNING,
            participants: ['brad'],
            created_at: new Date(),
            updated_at: new Date(),
            current_step: MealPlanningStep.INITIATE,
            meal_plan: null,
            feedback_history: [],
            iteration_count: 0,
            shopping_list: null,
            is_finalized: false,
          };
          // Generate, optimize, present, pause for feedback
          state = { ...state, ...(await this.initiateNode(state)) };
          await this.saveCheckpoint(config, state);
          state = { ...state, ...(await this.generatePlanNode(state)) };
          await this.saveCheckpoint(config, state);
          state = { ...state, ...(await this.optimizePlanNode(state)) };
          await this.saveCheckpoint(config, state);
          state = { ...state, ...(await this.presentPlanNode(state)) };
          await this.saveCheckpoint(config, state);
          // Pause: checkpoint state
          // Debug: log the final state before saving checkpoint
          infoLog(
            `🔍 [WORKFLOW] Final state before checkpoint: current_step=${state.current_step}`,
          );
          infoLog(
            `${`🔍 [WORKFLOW] Full state:`} ${JSON.stringify(state, null, 2)}`,
          );

          // Skip final checkpoint save to prevent hang - workflow state will be saved by backend
          infoLog(
            '🔍 [WORKFLOW] Skipping final checkpoint save to prevent timeout',
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

          state = {
            threadId: checkpoint.state.threadId,
            workflow_type: WorkflowType.MEAL_PLANNING,
            participants: checkpoint.state.participants,
            created_at: checkpoint.state.createdAt
              ? checkpoint.state.createdAt.toDate()
              : new Date(),
            updated_at: checkpoint.state.updatedAt
              ? checkpoint.state.updatedAt.toDate()
              : new Date(),
            current_step: checkpoint.state.currentStep as MealPlanningStep,
            meal_plan: deserializedMealPlan,
            feedback_history: checkpoint.state.feedbackHistory.map((f) => ({
              from: f.from,
              message: f.message,
              timestamp: f.timestamp ? f.timestamp.toDate() : new Date(),
              meal_plan_version: f.mealPlanVersion,
            })),
            iteration_count: checkpoint.state.iterationCount,
            shopping_list: checkpoint.state.shoppingList?.items ?? null,
            is_finalized: checkpoint.state.isFinalized,
          };
          infoLog(
            `🔄 [MEAL-WORKFLOW] Resuming workflow at step ${state.current_step}`,
          );
          // On resume, always: apply feedback (if any), re-optimize, present, and pause for feedback again until user is happy
          let feedbackSatisfied = false;
          while (!feedbackSatisfied) {
            // 1. Gather all feedback newer than last_feedback_applied_at
            const allFeedback = state.feedback_history || [];
            const lastApplied = state.last_feedback_applied_at
              ? new Date(state.last_feedback_applied_at)
              : new Date(0);
            const newFeedback = allFeedback.filter((f: FeedbackEntry) =>
              f.timestamp ? new Date(f.timestamp) > lastApplied : true,
            );

            // 2. Analyze feedback to determine user satisfaction
            let analyzeResult = { satisfied: false, reasoning: '' };
            if (newFeedback.length > 0) {
              analyzeResult = await this.analyzeFeedbackNode(newFeedback);
            }

            // 3. If satisfied, finalize plan and break loop
            if (analyzeResult.satisfied) {
              state.current_step = MealPlanningStep.FINALIZE_PLAN;
              feedbackSatisfied = true;
              break;
            }

            // 4. If there is new feedback and not satisfied, apply it
            if (newFeedback.length > 0) {
              // Apply feedback via LLM
              state = {
                ...state,
                ...(await this.applyFeedbackNode({
                  ...state,
                  feedback_to_apply: newFeedback,
                })),
              };
              state.last_feedback_applied_at = new Date(
                newFeedback[newFeedback.length - 1].timestamp,
              ).toISOString();
              state = { ...state, ...(await this.optimizePlanNode(state)) };
              await this.saveCheckpoint(config, state);
            }

            // 5. Present the plan after feedback is processed/applied
            state = { ...state, ...(await this.presentPlanNode(state)) };
            await this.saveCheckpoint(config, state);
            // 6. Pause for feedback after presenting the plan
            if (state.current_step === MealPlanningStep.AWAIT_FEEDBACK) {
              // Create properly typed checkpoint
              // DEBUGGING: Log meal plan before checkpoint serialization (feedback loop)
              if (state.meal_plan) {
                await infoLog(
                  '🔍 [CHECKPOINT-SAVE-FEEDBACK] mealPlan before checkpoint serialization:',
                );
                if (state.meal_plan.days) {
                  for (let i = 0; i < state.meal_plan.days.length; i++) {
                    const day = state.meal_plan.days[i];
                    await infoLog(
                      `🔍 [CHECKPOINT-SAVE-FEEDBACK] Entry ${i}: dayIndex=${day.dayIndex}, mealType=${day.mealType}, meal=${day.meal?.name || 'nil'}`,
                    );
                  }
                }
              }

              // DEBUGGING: Check if meal_plan is properly set before final checkpoint
              infoLog(
                `🔍 [FINAL-CHECKPOINT] About to save final checkpoint with meal_plan: ${state.meal_plan ? 'EXISTS' : 'NULL/UNDEFINED'}`,
              );
              if (state.meal_plan) {
                infoLog(
                  `🔍 [FINAL-CHECKPOINT] meal_plan has ${state.meal_plan.days?.length || 0} days`,
                );
              }

              const protoState = new MealPlanningCheckpointState({
                threadId: state.threadId,
                participants: state.participants,
                createdAt: Timestamp.fromDate(state.created_at),
                updatedAt: Timestamp.fromDate(state.updated_at),
                currentStep: state.current_step,
                mealPlan:
                  state.meal_plan ?? undefined,
                feedbackHistory: state.feedback_history.map((entry) => new FeedbackEntryProto({
                 from: entry.from,
                 message: entry.message,
                 timestamp: Timestamp.fromDate(entry.timestamp),
                 mealPlanVersion: entry.meal_plan_version,
               })),
                iterationCount: state.iteration_count,
                shoppingList: state.shopping_list ? new ShoppingList({ items: state.shopping_list }) : undefined,
                isFinalized: state.is_finalized,
              });
              const checkpoint = new AgentCheckpoint({
                state: protoState,
                messages: [],
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
            if (state.current_step === MealPlanningStep.FINALIZE_PLAN) {
              feedbackSatisfied = true;
            }
          }
          // Finalize, generate shopping list, complete
          state = { ...state, ...(await this.finalizePlanNode(state)) };
          state = { ...state, ...(await this.generateShoppingListNode(state)) };
          state = { ...state, ...(await this.completeNode(state)) };
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
      current_step: MealPlanningStep.GENERATE_PLAN,
      meal_plan: null,
      feedback_history: [],
      iteration_count: 0,
      shopping_list: null,
      is_finalized: false,
      updated_at: new Date(),
    };
  }

  private async saveMealPlan(threadId: string, plan: WeeklyMealPlan) {
    infoLog('MealPlanningWorkflow.saveMealPlan called');
    try {
      const backend = process.env.BACKEND_URL ?? 'http://localhost:8080';

      // DEBUGGING: Log dayIndex values BEFORE coerceDates and serialization
      await infoLog(
        '🔍 [AGENT] dayIndex values BEFORE saveMealPlan processing:',
      );
      if (plan.days) {
        for (let i = 0; i < plan.days.length; i++) {
          const day = plan.days[i];
          await infoLog(
            `🔍 [AGENT] SAVE BEFORE Entry ${i}: dayIndex=${day.dayIndex}, mealType=${day.mealType}, meal=${day.meal?.name || 'nil'}`,
          );
        }
      }

      this.coerceDates(plan);
      // Use the typed entries directly (they still contain Date objects)
      const entries = plan.days;

      const saveRequest = new SaveMealPlanRequest({
        threadId,
        version: 0,
        entries,
      });

      // DEBUGGING: Log dayIndex values in the serialized body
      await infoLog('🔍 [AGENT] dayIndex values in saveRequest:');
      if (saveRequest.entries) {
        for (let i = 0; i < saveRequest.entries.length; i++) {
          const entry = saveRequest.entries[i];
          await infoLog(
            `🔍 [AGENT] SAVE JSON Entry ${i}: dayIndex=${entry.dayIndex}, mealType=${entry.mealType}, meal=${entry.meal?.name || 'nil'}`,
          );
        }
      }

      debugLog('Full body for save request');
      debug(JSON.stringify(saveRequest));
      await fetch(`${backend}/api/mealplan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saveRequest),
      });
    } catch (err) {
      warnLog(`⚠️ [MEAL-WORKFLOW] Failed to persist meal plan ${err}`);
      throw err;
    }
  }

  private async generatePlanNode(
    _state: MealPlanningState,
  ): Promise<Partial<MealPlanningState>> {
    infoLog('MealPlanningWorkflow.generatePlanNode called');
    const reqId = uuidv4();
    infoLog(`🍽️ [MEAL-WORKFLOW] Generating initial meal plan: ${reqId}`);

    try {
      // Generate meal plan using MCP tool
      const planResult = await this.client.callTool({
        name: 'generateMealPlan',
        arguments: {},
      });
      const planResultString = JSON.stringify(planResult);
      await infoLog(`PLAN RESULT FROM MCP: ${reqId}`);
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

      await infoLog(`MEAL PLAN from generate------- req: ${reqId}`);
      await infoLog(JSON.stringify(mealPlan, null, 2));
      await this.saveMealPlan(_state.threadId, mealPlan);

      return {
        current_step: MealPlanningStep.OPTIMIZE_PLAN,
        meal_plan: mealPlan,
        updated_at: new Date(),
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
      `🍽️ [MEAL-WORKFLOW] Optimizing meal plan (iteration ${state.iteration_count + 1})`,
    );

    const threadId = state.threadId;

    if (!state.meal_plan) {
      throw new Error('No meal plan to optimize');
    }

    const issues = this.validatePlan(state.meal_plan);
    let optimizedPlan = state.meal_plan;

    if (issues.length > 0) {
      infoLog(
        `${`📋 [MEAL-WORKFLOW] Found ${issues.length} issues:`} ${issues}`,
      );
      optimizedPlan = await this.optimizePlanWithLLM(state.meal_plan, issues);
    } else {
      infoLog(`✅ [MEAL-WORKFLOW] Plan is already valid`);
    }

    await this.saveMealPlan(threadId, optimizedPlan);

    return {
      current_step: MealPlanningStep.PRESENT_PLAN,
      meal_plan: optimizedPlan,
      iteration_count: state.iteration_count + 1,
      updated_at: new Date(),
    };
  }

  // New: apply feedback using LLM with feedback context
  private async applyFeedbackNode(
    state: MealPlanningState & { feedback_to_apply?: FeedbackEntry[] },
  ): Promise<Partial<MealPlanningState>> {
    infoLog('MealPlanningWorkflow.applyFeedbackNode called');
    infoLog(`🍽️ [MEAL-WORKFLOW] Applying user feedback via LLM`);
    if (!state.meal_plan) {
      throw new Error('No meal plan to apply feedback to');
    }
    // Gather ALL feedback from the entire session or use provided feedback_to_apply
    const feedbackEntries =
      state.feedback_to_apply ??
      (await this.feedbackHandler.getFeedback(state.threadId));
    const feedbackMessages = feedbackEntries.map((f) => f.message);
    // Call LLM to pick alternatives based on feedback
    const result = await this.applyFeedbackWithLLM(
      state.meal_plan,
      feedbackMessages,
      state.threadId,
    );
    await this.saveMealPlan(state.threadId, result.mealPlan);
    return {
      meal_plan: result.mealPlan,
      user_message: result.userMessage,
      updated_at: new Date(),
    };
  }

  // Analyze feedback using nano LLM. Returns { satisfied: boolean, reasoning: string }
  private async analyzeFeedbackNode(
    feedbackEntries: FeedbackEntry[],
  ): Promise<{ satisfied: boolean; reasoning: string }> {
    infoLog('MealPlanningWorkflow.analyzeFeedbackNode called');
    infoLog(`🍽️ [MEAL-WORKFLOW] Analyzing feedback: ${feedbackEntries}`);
    const latestFeedback = feedbackEntries[feedbackEntries.length - 1];
    const prompt = getAnalyzeFeedbackPrompt(latestFeedback.message);
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
    threadId: string,
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
                  meal: newMeal as GeneratedMeal,
                });
              }
              return planDay;
            });
          }
        }
      }

      // Save the updated plan to backend after all local changes
      await this.saveMealPlan(threadId, updatedPlan);
      infoLog(
        `🤖 [MEAL-WORKFLOW] Saved updated plan to backend after applying all changes`,
      );
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

    if (!state.meal_plan) {
      throw new Error('No meal plan to present');
    }

    // Format plan for presentation
    const planPresentation = this.formatPlanForPresentation(state.meal_plan);
    infoLog(`📋 [MEAL-PLAN]\n${planPresentation}`);

    // Check if we have recent feedback that requires processing

    return {
      current_step: MealPlanningStep.AWAIT_FEEDBACK,
      updated_at: new Date(),
    };
  }

  private async finalizePlanNode(
    state: MealPlanningState,
  ): Promise<Partial<MealPlanningState>> {
    infoLog('MealPlanningWorkflow.finalizePlanNode called');
    infoLog(`🍽️ [MEAL-WORKFLOW] Finalizing meal plan`);

    if (!state.meal_plan) {
      throw new Error('No meal plan to finalize');
    }

    // Save the meal plan using MCP tool
    try {
      await this.client.callTool({
        name: 'finalizeMealPlan',
        arguments: { mealPlan: state.meal_plan },
      });

      infoLog(`✅ [MEAL-WORKFLOW] Meal plan saved successfully`);
    } catch (error) {
      warnLog(`${`⚠️ [MEAL-WORKFLOW] Could not save meal plan:`} ${error}`);
      // Continue anyway as this is not critical for the workflow
    }

    return {
      current_step: MealPlanningStep.GENERATE_SHOPPING_LIST,
      is_finalized: true,
      updated_at: new Date(),
    };
  }

  private async generateShoppingListNode(
    state: MealPlanningState,
  ): Promise<Partial<MealPlanningState>> {
    infoLog('MealPlanningWorkflow.generateShoppingListNode called');
    infoLog(`🍽️ [MEAL-WORKFLOW] Generating shopping list`);

    if (!state.meal_plan) {
      throw new Error('No meal plan for shopping list generation');
    }

    try {
      // Extract meal IDs from the meal plan
      const mealIds = state.meal_plan.days
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
          current_step: MealPlanningStep.COMPLETE,
          shopping_list: [],
          updated_at: new Date(),
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
        current_step: MealPlanningStep.COMPLETE,
        shopping_list: shoppingList,
        shopping_list_formatted: shoppingListFormatted,
        updated_at: new Date(),
      };
    } catch (error) {
      errorLog(
        `${`❌ [MEAL-WORKFLOW] Error generating shopping list:`} ${error}`,
      );
      // Continue with empty shopping list on error
      return {
        current_step: MealPlanningStep.COMPLETE,
        shopping_list: [],
        _error:
          error instanceof Error
            ? error.message
            : 'Failed to generate shopping list',
        updated_at: new Date(),
      };
    }
  }

  private async completeNode(
    state: MealPlanningState,
  ): Promise<Partial<MealPlanningState>> {
    infoLog('MealPlanningWorkflow.completeNode called');
    infoLog(`🍽️ [MEAL-WORKFLOW] Meal planning workflow completed`);

    // Final validation
    const finalIssues = state.meal_plan
      ? this.validatePlan(state.meal_plan)
      : [];
    if (finalIssues.length > 0) {
      warnLog(`${`⚠️ [MEAL-WORKFLOW] Final plan has issues:`} ${finalIssues}`);
    }

    return {
      current_step: MealPlanningStep.COMPLETE,
      updated_at: new Date(),
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
                  meal: newMeal as GeneratedMeal,
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
