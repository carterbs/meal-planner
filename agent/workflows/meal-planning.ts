import { ChatOpenAI } from "@langchain/openai";
import { FakeChatModel } from "@langchain/core/utils/testing";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import {
  MealPlanningState,
  MealPlanningStep,
  WorkflowType,
  VALIDATION_CRITERIA,
  WeeklyMealPlan,
  FeedbackEntry,
  InternalMeal,
} from "../shared/types";
import { BaseWorkflow } from "../registry";
import { debugLog } from "../cli";
import { PostgresCheckpointSaver } from "../shared/checkpointer";
import { FeedbackHandler } from "./feedback-handler";
import {
  ShoppingListResponse,
  ShoppingListItem,
  MCPToolResult as MCPToolResultType,
} from "../shared/mcp-types";
import { DAYS_OF_THE_WEEK } from '../../shared/ts/days';
const DEBUG_LOGS = false;
interface MCPTextContent {
  type: "text";
  text: string;
}

interface MCPToolResult {
  content: MCPTextContent[];
  isError?: boolean;
}

export class MealPlanningWorkflow implements BaseWorkflow {
  /**
   * Helper to extract JSON from LLM responses (removes markdown code fences, whitespace, etc)
   */
  private extractJsonFromResponse(response: string): string {
    return response
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
  }
  readonly type = WorkflowType.MEAL_PLANNING;
  readonly graph: any;
  private client: Client;
  private llm: any;
  private nanoLlm: any;
  private checkpointer: PostgresCheckpointSaver;
  private feedbackHandler: FeedbackHandler;

  constructor(checkpointer: PostgresCheckpointSaver) {
    this.checkpointer = checkpointer;
    this.feedbackHandler = new FeedbackHandler(checkpointer);
    this.client = new Client({
      name: "meal-planner-workflow",
      version: "1.0.0",
    });

    // Create workflow graph
    this.graph = this.createGraph();
  }

  async initialize(): Promise<void> {
    const isCodex = process.argv.includes("--codex");
    const isJsonMode = process.argv.includes("--json");

    // Connect to MCP server
    // In JSON mode (API calls), assume MCP server is already running and connect to it directly
    // Otherwise, start the full server stack
    const transport = new StdioClientTransport({
      command: "node",
      args: isJsonMode
        ? [
            "/Users/bradcarter/Documents/Dev/meal-planner/backend/mcp/dist/index.js",
          ]
        : [
            "/Users/bradcarter/Documents/Dev/meal-planner/scripts/start-mcp.js",
            isCodex ? "--codex" : "",
          ],
    });

    await this.client.connect(transport);

    // Initialize LLM
    const isTestMode = process.env.NODE_ENV === "test";
    this.llm = isCodex
      ? new FakeChatModel({})
      : new ChatOpenAI({
          temperature: 0,
          modelName: isTestMode ? "gpt-4.1-nano" : "gpt-4.1",
        });
    // Initialize nano LLM for feedback analysis
    this.nanoLlm = new ChatOpenAI({
      temperature: 0,
      modelName: "gpt-4.1-nano",
    });

    console.log(`🍽️ [MEAL-WORKFLOW] Initialized meal planning workflow`);
  }

  async cleanup(): Promise<void> {
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
      invoke: async (input: any, config: any) => {
        console.log(`🍽️ [MEAL-WORKFLOW] Invoking workflow; input:`, input);
        // Load checkpoint
        const tuple = await this.checkpointer.getTuple(config);
        let state: MealPlanningState;
        if (!tuple) {
          // Initial run
          state = {
            threadId: config.configurable.threadId,
            workflow_type: WorkflowType.MEAL_PLANNING,
            participants: ["brad"],
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
          state = { ...state, ...(await this.generatePlanNode(state)) };
          state = { ...state, ...(await this.optimizePlanNode(state)) };
          state = { ...state, ...(await this.presentPlanNode(state)) };
          // Pause: checkpoint state
          await this.checkpointer.put(
            config,
            { channel_values: state, next: [], step: 0 },
            { source: "workflow", step: 0, writes: {} },
          );
          return state;
        } else {
          // Resume run: feedback loop
          const [checkpoint] = tuple;
          state = checkpoint.channel_values as MealPlanningState;
          console.log(
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
            const newFeedback = allFeedback.filter(
              (f) => new Date(f.timestamp) > lastApplied,
            );

            // 2. Analyze feedback to determine user satisfaction
            let analyzeResult = { satisfied: false, reasoning: "" };
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
            }

            // 5. Present the plan after feedback is processed/applied
            state = { ...state, ...(await this.presentPlanNode(state)) };
            // 6. Pause for feedback after presenting the plan
            if (state.current_step === MealPlanningStep.AWAIT_FEEDBACK) {
              await this.checkpointer.put(
                config,
                { channel_values: state, next: [], step: 0 },
                { source: "workflow", step: 0, writes: {} },
              );
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
    console.log(
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

  private async generatePlanNode(
    _state: MealPlanningState,
  ): Promise<Partial<MealPlanningState>> {
    console.log(`🍽️ [MEAL-WORKFLOW] Generating initial meal plan`);

    try {
      // Generate meal plan using MCP tool
      const planResult = await this.client.callTool({
        name: "generateMealPlan",
        arguments: {},
      });

      const backendPlan = JSON.parse(
        this.extractJsonFromResponse(
          (planResult as MCPToolResult).content[0].text,
        ),
      );
      const mealPlan = this.transformBackendPlan(backendPlan);

      return {
        current_step: MealPlanningStep.OPTIMIZE_PLAN,
        meal_plan: mealPlan,
        updated_at: new Date(),
      };
    } catch (error) {
      console.error(`❌ [MEAL-WORKFLOW] Error generating plan:`, error);
      throw error;
    }
  }

  private async optimizePlanNode(
    state: MealPlanningState,
  ): Promise<Partial<MealPlanningState>> {
    console.log(
      `🍽️ [MEAL-WORKFLOW] Optimizing meal plan (iteration ${state.iteration_count + 1})`,
    );

    if (!state.meal_plan) {
      throw new Error("No meal plan to optimize");
    }

    const issues = this.validatePlan(state.meal_plan);
    let optimizedPlan = state.meal_plan;

    if (issues.length > 0) {
      console.log(`📋 [MEAL-WORKFLOW] Found ${issues.length} issues:`, issues);
      optimizedPlan = await this.optimizePlanWithLLM(state.meal_plan, issues);
    } else {
      console.log(`✅ [MEAL-WORKFLOW] Plan is already valid`);
    }

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
    console.log(`🍽️ [MEAL-WORKFLOW] Applying user feedback via LLM`);
    if (!state.meal_plan) {
      throw new Error("No meal plan to apply feedback to");
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
    const latestFeedback = feedbackEntries[feedbackEntries.length - 1];
    const prompt = `Given the following user feedback on a meal plan, does the user want changes or are they satisfied? Respond with a JSON object: { "satisfied": true/false, "reasoning": "..." }\n\nFeedback: ${latestFeedback.message}`;
    const result = await this.nanoLlm.invoke([
      { role: "user", content: prompt },
    ]);
    let analysis = {
      satisfied: false,
      reasoning: "Could not parse LLM response.",
    };
    try {
      analysis = JSON.parse(
        this.extractJsonFromResponse(
          typeof result.content === "string"
            ? result.content
            : JSON.stringify(result.content),
        ),
      );
    } catch (err) {
      console.error(
        "❌ [MEAL-WORKFLOW] Failed to parse feedback analysis response:",
        err,
      );
    }
    return analysis;
  }

  private async applyFeedbackWithLLM(
    plan: WeeklyMealPlan,
    feedback: string[],
    threadId: string,
  ): Promise<{ mealPlan: WeeklyMealPlan; userMessage: string }> {
    const t0 = Date.now();
    debugLog(
      `[FEEDBACK] applyFeedbackWithLLM start (feedbackCount=${feedback.length})`,
    );
    // Fetch available meals
    const mealsResp = await this.client.callTool({
      name: "getMeals",
      arguments: {},
    });
    const availableMeals: any[] = JSON.parse(
      this.extractJsonFromResponse(
        (mealsResp as MCPToolResult).content[0].text,
      ),
    );
    const mealOptions = availableMeals
      .map(
        (m) =>
          `${m.id}: ${m.name} (${m.mealType}, effort: ${m.effort}, red meat: ${m.hasRedMeat})`,
      )
      .join("\n");
    const dayNames = DAYS_OF_THE_WEEK;
    const planDescription = plan.days
      .filter((day) => day.meal)
      .map(
        (day) =>
          `${dayNames[day.dayIndex]} ${day.mealType}: ${day.meal!.name} (ID: ${day.meal!.id}, effort: ${day.meal!.effort}, red meat: ${day.meal!.hasRedMeat})`,
      )
      .join("\n");
    const feedbackText =
      feedback.length > 0
        ? `ALL USER FEEDBACK FROM THIS SESSION (in chronological order):\n${feedback.map((msg, idx) => `${idx + 1}. ${msg}`).join("\n")}\n`
        : "";
    const prompt = `You are updating a weekly meal plan based on ALL user feedback from the entire session.\n
    ${feedbackText}\n
    Current meal plan:\n${planDescription}\n\n
    Available meals to choose from:\n${mealOptions}\n\n
    IMPORTANT GUIDELINES:\n
    - Consider ALL feedback messages above when making decisions\n
    - If feedback is contradictory or impossible to satisfy (e.g., "no eggs, no cereal, no bagels" for breakfast), do your best and explain the constraints in your message\n
    - Only replace meals with the same meal type (breakfast/lunch/dinner)\n
    - Avoid duplicate meals\n
    - Avoid suggesting meals that have been explicitly rejected in ANY previous feedback\n
    - When constraints are impossible to meet, choose the best available options and explain why in your message\n\n
    - Respond with ONLY a JSON object containing your recommended removals and/or replacements AND a friendly message to the user:\n\n
    {
      "removals": [],
      "replacements": [
        {
          "day": "Sunday",
          "mealType": "dinner",
          "oldMealId": 9,
          "newMealId": 50,
          "reason": "Replace as requested in feedback"
        }
      ],
      "userMessage": "Thanks for your feedback! I've swapped out the Steak dinner for Chicken nuggets - a much easier option that should work better for your needs."
    }
    
    For the userMessage:
    - Be conversational and friendly (1-2 sentences)
    - Mention what meals were changed and why
    - If constraints are impossible to meet, acknowledge this: "I know you asked to avoid both X and Y, but those are the main breakfast options available, so I picked the best alternative..."
    - If no changes were needed, explain why the current plan already meets their needs
    
    If no removals or replacements are needed, return: {"removals": [], "replacements": [], "userMessage": "Your current meal plan already looks great and addresses your preferences!"}\n\n<important> Your response should be parseable as JSON.</important>`;
    const result = await this.llm.invoke([{ role: "user", content: prompt }]);
    const llmResponse =
      typeof result.content === "string"
        ? result.content
        : JSON.stringify(result.content);
    console.log(`🤖 [MEAL-WORKFLOW] Raw LLM response:`);
    console.log(llmResponse);
    let updatedPlan = { ...plan, days: [...plan.days] };
    let userMessage = "I've updated your meal plan based on your feedback!"; // Default fallback message

    try {
      const cleanedResponse = this.extractJsonFromResponse(llmResponse);
      console.log(`🤖 [MEAL-WORKFLOW] Cleaned JSON response:`);
      console.log(cleanedResponse);
      const recommendations = JSON.parse(cleanedResponse);

      // Extract user message from LLM response
      if (
        recommendations.userMessage &&
        typeof recommendations.userMessage === "string"
      ) {
        userMessage = recommendations.userMessage;
      }

      // Handle removals first
      if (recommendations.removals && Array.isArray(recommendations.removals)) {
        for (const removal of recommendations.removals) {
          const { day, mealType, reason } = removal;
          const dayIndex = dayNames.indexOf(day);
          if (dayIndex >= 0) {
            console.log(
              `🤖 [MEAL-WORKFLOW] Applying removal from the LLM: Remove ${day} ${mealType} - ${reason}`,
            );
            console.log(
              `🤖 [MEAL-WORKFLOW] Calling removeMeal with threadId=${threadId}, dayIndex=${dayIndex}, mealType=${mealType}`,
            );
            try {
              const removalResult = (await this.client.callTool({
                name: "removeMeal",
                arguments: { threadId, dayIndex, mealType },
              })) as MCPToolResult;
              console.log(
                `🤖 [MEAL-WORKFLOW] MCP removeMeal result:`,
                JSON.stringify(removalResult, null, 2),
              );
              console.log(
                `🤖 [MEAL-WORKFLOW] removalResult.isError:`,
                removalResult.isError,
              );
              console.log(
                `🤖 [MEAL-WORKFLOW] removalResult.content:`,
                removalResult.content,
              );
              console.log(
                `🤖 [MEAL-WORKFLOW] typeof removalResult:`,
                typeof removalResult,
              );
              console.log(
                `🤖 [MEAL-WORKFLOW] removalResult keys:`,
                Object.keys(removalResult || {}),
              );

              if (removalResult.isError) {
                const errorContent =
                  Array.isArray(removalResult.content) &&
                  removalResult.content[0]?.type === "text"
                    ? removalResult.content[0].text
                    : "Unknown MCP error";
                throw new Error(`MCP removeMeal failed: ${errorContent}`);
              }

              if (
                !removalResult.content ||
                !Array.isArray(removalResult.content) ||
                !removalResult.content[0]
              ) {
                console.error(
                  `🤖 [MEAL-WORKFLOW] Invalid MCP response structure:`,
                  removalResult,
                );
                throw new Error(`Invalid MCP response structure`);
              }

              const responseText = removalResult.content[0].text;
              console.log(
                `🤖 [MEAL-WORKFLOW] Raw response text:`,
                responseText,
              );
              const backendPlan = JSON.parse(
                this.extractJsonFromResponse(responseText),
              );
              console.log(
                `🤖 [MEAL-WORKFLOW] Parsed backend plan:`,
                JSON.stringify(backendPlan, null, 2),
              );
              updatedPlan = this.transformBackendPlan(backendPlan);
            } catch (mcpError) {
              console.error(`❌ [MEAL-WORKFLOW] MCP tool call failed:`);
              console.error(
                `Error message:`,
                (mcpError as any)?.message || "No message",
              );
              console.error(
                `Error stack:`,
                (mcpError as any)?.stack || "No stack",
              );
              console.error(
                `Error name:`,
                (mcpError as any)?.name || "No name",
              );
              console.error(`Error type:`, typeof mcpError);
              console.error(
                `Full error object:`,
                JSON.stringify(
                  mcpError,
                  Object.getOwnPropertyNames(mcpError),
                  2,
                ),
              );
              throw mcpError;
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
            console.log(
              `🤖 [MEAL-WORKFLOW] Applying feedback from the LLM: Replace ${day} ${mealType} (ID ${oldMealId}) with ${newMeal.name} (ID ${newMealId}) - ${reason}`,
            );
            updatedPlan.days = updatedPlan.days.map((planDay) => {
              if (
                planDay.dayIndex === dayIndex &&
                planDay.mealType === mealType
              ) {
                return {
                  ...planDay,
                  meal: this.transformMeal(newMeal),
                };
              }
              return planDay;
            });
          }
        }
      }
    } catch (error) {
      console.error(
        "❌ [MEAL-WORKFLOW] Failed to parse LLM feedback response:",
        error,
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
    console.log(`🍽️ [MEAL-WORKFLOW] Presenting meal plan to participants`);

    if (!state.meal_plan) {
      throw new Error("No meal plan to present");
    }

    // Format plan for presentation
    const planPresentation = this.formatPlanForPresentation(state.meal_plan);
    console.log(`📋 [MEAL-PLAN]\n${planPresentation}`);

    // Check if we have recent feedback that requires processing

    return {
      current_step: MealPlanningStep.AWAIT_FEEDBACK,
      updated_at: new Date(),
    };
  }

  private async finalizePlanNode(
    state: MealPlanningState,
  ): Promise<Partial<MealPlanningState>> {
    console.log(`🍽️ [MEAL-WORKFLOW] Finalizing meal plan`);

    if (!state.meal_plan) {
      throw new Error("No meal plan to finalize");
    }

    // Save the meal plan using MCP tool
    try {
      await this.client.callTool({
        name: "finalizeMealPlan",
        arguments: { mealPlan: state.meal_plan },
      });

      console.log(`✅ [MEAL-WORKFLOW] Meal plan saved successfully`);
    } catch (error) {
      console.warn(`⚠️ [MEAL-WORKFLOW] Could not save meal plan:`, error);
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
    console.log(`🍽️ [MEAL-WORKFLOW] Generating shopping list`);

    if (!state.meal_plan) {
      throw new Error("No meal plan for shopping list generation");
    }

    try {
      // Extract meal IDs from the meal plan
      const mealIds = state.meal_plan.days
        .map((day) => day.meal?.id)
        .filter((id): id is number => id !== undefined)
        .filter((id, index, self) => self.indexOf(id) === index); // Deduplicate

      console.log(
        `🛒 [MEAL-WORKFLOW] Generating shopping list for meal IDs:`,
        mealIds,
      );

      // Call the MCP tool directly with proper typing
      const result = (await this.client.callTool({
        name: "generateShoppingList",
        arguments: { plan: mealIds },
      })) as MCPToolResultType;

      if (result.isError) {
        const errorContent =
          Array.isArray(result.content) && result.content[0]?.type === "text"
            ? result.content[0].text
            : "Unknown error";
        throw new Error(`MCP tool error: ${errorContent}`);
      }

      // Parse the response with proper type checking
      const responseText =
        Array.isArray(result.content) && result.content[0]?.type === "text"
          ? result.content[0].text
          : "[]";

      if (DEBUG_LOGS) {
        console.log("🛒 [DEBUG] Raw shopping list response:", responseText);
      }
      const shoppingList = JSON.parse(responseText) as ShoppingListResponse;
      if (DEBUG_LOGS) {
        console.log(
          "🛒 [DEBUG] Parsed shopping list:",
          JSON.stringify(shoppingList, null, 2),
        );
      }

      console.log(
        `✅ [MEAL-WORKFLOW] Generated shopping list with ${shoppingList.length} items`,
      );

      // Display the shopping list in a nice format
      console.log("\n🛍️  SHOPPING LIST 🛒");
      console.log("===================");

      if (!Array.isArray(shoppingList) || shoppingList.length === 0) {
        console.log("\nNo items in shopping list");
        return {
          current_step: MealPlanningStep.COMPLETE,
          shopping_list: [],
          updated_at: new Date(),
        };
      }
      let shoppingListFormatted = "";
      try {
        // Group items by category if available
        const groupedItems = shoppingList.reduce(
          (acc: Record<string, ShoppingListItem[]>, item) => {
            if (!item || typeof item !== "object") {
              console.warn("Skipping invalid shopping list item:", item);
              return acc;
            }

            const category =
              item.category && typeof item.category === "string"
                ? item.category
                : "Other";
            const ingredient =
              item.ingredient && typeof item.ingredient === "string"
                ? item.ingredient
                : "Unknown ingredient";
            const quantity =
              item.quantity && typeof item.quantity === "string"
                ? item.quantity
                : "";

            if (!acc[category]) {
              acc[category] = [];
            }

            acc[category].push({
              ingredient,
              quantity,
              category,
            });

            return acc;
          },
          {},
        );

        // Format shopping list as a bulleted string (grouped by category)
        let bulletedList = "";
        for (const [category, items] of Object.entries(groupedItems)) {
          bulletedList += `\n${category.toUpperCase()}:\n`.trimStart();
          (items as ShoppingListItem[]).forEach((item) => {
            bulletedList += `- ${[item.quantity, item.ingredient].join(" ").trimStart()}\n`;
          });
        }
        bulletedList = bulletedList.trim();

        // Pantry staples prompt
        const PANTRY_STAPLES_CATEGORIZATION_PROMPT = `I will provide a bulleted shopping list to you. You should return a bulleted list with two sections: Pantry Staples and Groceries. Identify which items in the bulleted shopping list below are pantry staples (e.g., oil, salt, flour, sugar, rice, canned beans, spices, herbs), and put them in their own section. Do not remove items from the list, and ensure wording is unchanged. Return ONLY the list.\n\n${bulletedList}`;

        try {
          console.log(
            `\n🛒 [LLM FORMATTED SHOPPING LIST]: Asking LLM to categorize our list: ${bulletedList}...\n`,
          );
          const llmResult = await this.llm.invoke([
            { role: "user", content: PANTRY_STAPLES_CATEGORIZATION_PROMPT },
          ]);
          shoppingListFormatted =
            typeof llmResult.content === "string"
              ? llmResult.content
              : JSON.stringify(llmResult.content);
          console.log(
            "\n🛒 [LLM FORMATTED SHOPPING LIST]:\n",
            shoppingListFormatted,
          );
        } catch (llmError) {
          console.error(
            "❌ Error calling LLM for pantry staples formatting:",
            llmError,
          );
          shoppingListFormatted = bulletedList; // fallback
        }

        console.log("\nHappy shopping! 🛒");
        console.log("===================\n");
      } catch (error) {
        console.error("❌ Error formatting shopping list:", error);
        // Fallback: display raw data if formatting fails
        console.log("\nRaw shopping list data:");
        console.log(JSON.stringify(shoppingList, null, 2));
      }

      return {
        current_step: MealPlanningStep.COMPLETE,
        shopping_list: shoppingList,
        shopping_list_formatted: shoppingListFormatted,
        updated_at: new Date(),
      };
    } catch (error) {
      console.error(
        `❌ [MEAL-WORKFLOW] Error generating shopping list:`,
        error,
      );
      // Continue with empty shopping list on error
      return {
        current_step: MealPlanningStep.COMPLETE,
        shopping_list: [],
        _error:
          error instanceof Error
            ? error.message
            : "Failed to generate shopping list",
        updated_at: new Date(),
      };
    }
  }

  private async completeNode(
    state: MealPlanningState,
  ): Promise<Partial<MealPlanningState>> {
    console.log(`🍽️ [MEAL-WORKFLOW] Meal planning workflow completed`);

    // Final validation
    const finalIssues = state.meal_plan
      ? this.validatePlan(state.meal_plan)
      : [];
    if (finalIssues.length > 0) {
      console.warn(`⚠️ [MEAL-WORKFLOW] Final plan has issues:`, finalIssues);
    }

    return {
      current_step: MealPlanningStep.COMPLETE,
      updated_at: new Date(),
    };
  }

  private validatePlan(plan: WeeklyMealPlan): string[] {
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
      issues.push(`Duplicate meals found: ${duplicates.join(", ")}`);
    }

    return issues;
  }

  private transformMeal(backendMeal: any): InternalMeal {
    return {
      id: backendMeal.id,
      name: backendMeal.mealName ?? backendMeal.name,
      effort: backendMeal.relativeEffort ?? backendMeal.effort,
      hasRedMeat: backendMeal.redMeat ?? backendMeal.hasRedMeat,
    };
  }

  private transformBackendPlan(backendPlan: any): WeeklyMealPlan {
    if (Array.isArray(backendPlan?.days)) {
      // If it's already in the correct format, transform any meals that might be in backend format
      const plan = backendPlan as WeeklyMealPlan;
      plan.days = plan.days.map(day => ({
        ...day,
        meal: day.meal ? this.transformMeal(day.meal) : null
      }));
      return plan;
    }

    const days = [];
    const dayNames = DAYS_OF_THE_WEEK;
    const mealTypes = ["Breakfast", "Lunch", "Dinner"] as const;

    for (let i = 0; i < dayNames.length; i++) {
      const dayName = dayNames[i];
      const dayData = backendPlan[dayName];

      if (dayData) {
        for (const mealType of mealTypes) {
          const meal = dayData[mealType];
          if (meal && meal.id) {
            days.push({
              dayIndex: i,
              mealType: mealType.toLowerCase(),
              meal: this.transformMeal(meal),
            });
          } else {
            days.push({
              dayIndex: i,
              mealType: mealType.toLowerCase(),
              meal: null,
            });
          }
        }
      } else {
        // if no dayData still push empty entries
        for (const mealType of mealTypes) {
          days.push({
            dayIndex: i,
            mealType: mealType.toLowerCase(),
            meal: null,
          });
        }
      }
    }

    return { days };
  }

  private async optimizePlanWithLLM(
    plan: WeeklyMealPlan,
    issues: string[],
  ): Promise<WeeklyMealPlan> {
    // Fetch available meals
    const mealsResp = await this.client.callTool({
      name: "getMeals",
      arguments: {},
    });
    const availableMeals: any[] = JSON.parse(
      (mealsResp as MCPToolResult).content[0].text,
    );

    // Create concise meal options for the prompt
    const mealOptions = availableMeals
      .map(
        (m) =>
          `${m.id}: ${m.name} (${m.mealType}, effort: ${m.effort}, red meat: ${m.hasRedMeat})`,
      )
      .join("\n");

    const dayNames = DAYS_OF_THE_WEEK;
    const planDescription = plan.days
      .filter((day) => day.meal)
      .map(
        (day) =>
          `${dayNames[day.dayIndex]} ${day.mealType}: ${day.meal!.name} (ID: ${day.meal!.id}, effort: ${day.meal!.effort}, red meat: ${day.meal!.hasRedMeat})`,
      )
      .join("\n");

    const prompt = `You are optimizing a weekly meal plan. Here are the current issues:
        ${issues.join("\n")}

        Current meal plan:
        ${planDescription}

        Available meals to choose from:
        ${mealOptions}

        Optimization rules:
        - Max ${VALIDATION_CRITERIA.maxConsecutiveHighEffort} consecutive high-effort meals (effort > 3)
        - Max ${VALIDATION_CRITERIA.maxRedMeatPerWeek} red meat meals per week
        - No duplicate meals
        - Only replace meals with same meal type (breakfast/lunch/dinner)
        - Prefer lower effort meals (1-2) for replacements

        Please analyze the issues and respond with ONLY a JSON object containing your recommended replacements:
        {
          "replacements": [
            {
              "day": "Sunday",
              "mealType": "dinner",
              "oldMealId": 9,
              "newMealId": 50,
              "reason": "Replace high-effort meal"
            }
          ]
        }
        If no replacements are needed, return: {"replacements": []}.

        <important> Your response should be parseable as JSON.</important>`;

    const result = await this.llm.invoke([{ role: "user", content: prompt }]);
    const llmResponse =
      typeof result.content === "string"
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
            console.log(
              `🤖 [MEAL-WORKFLOW] Applying optimization: Replace ${day} ${mealType} (ID ${oldMealId}) with ${newMeal.name} (ID ${newMealId}) - ${reason}`,
            );

            optimizedPlan.days = optimizedPlan.days.map((planDay) => {
              if (
                planDay.dayIndex === dayIndex &&
                planDay.mealType === mealType
              ) {
                return {
                  ...planDay,
                  meal: this.transformMeal(newMeal),
                };
              }
              return planDay;
            });
          }
        }
      }
    } catch (error) {
      console.error("❌ [MEAL-WORKFLOW] Failed to parse LLM response:", error);
    }

    return optimizedPlan;
  }

  private formatPlanForPresentation(plan: WeeklyMealPlan): string {
    const dayNames = DAYS_OF_THE_WEEK;
    const lines: string[] = [];

    lines.push("📅 Weekly Meal Plan:");
    lines.push("=".repeat(50));

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const dayMeals = plan.days.filter((d) => d.dayIndex === dayIndex);
      if (dayMeals.length > 0) {
        lines.push(`\n${dayNames[dayIndex]}:`);
        for (const dayMeal of dayMeals) {
          if (!dayMeal.meal) {
            lines.push(`  ${dayMeal.mealType}: (no meal)`);
            continue;
          }
          const effort = "🔥".repeat(dayMeal.meal.effort);
          const redMeat = dayMeal.meal.hasRedMeat ? "🥩" : "";
          lines.push(
            `  ${dayMeal.mealType}: ${dayMeal.meal.name} ${effort} ${redMeat}`,
          );
        }
      }
    }

    return lines.join("\n");
  }
}
