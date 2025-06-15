import { StateGraph, END, START } from '@langchain/langgraph';
import { RunnableConfig } from '@langchain/core/runnables';
import { ChatOpenAI } from '@langchain/openai';
import { FakeChatModel } from '@langchain/core/utils/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { 
  MealPlanningState, 
  MealPlanningStep, 
  WorkflowType, 
  VALIDATION_CRITERIA,
  InternalMeal,
  WeeklyMealPlan,
  FeedbackEntry,
  ShoppingItem
} from '../shared/types.js';
import { BaseWorkflow } from '../registry.js';
import { PostgresCheckpointSaver } from '../shared/checkpointer.js';
import { FeedbackHandler } from './feedback-handler.js';
import { 
  ShoppingListResponse,
  ShoppingListItem,
  MCPToolResult as MCPToolResultType
} from '../shared/mcp-types.js';

interface MCPTextContent {
  type: 'text';
  text: string;
}

interface MCPToolResult {
  content: MCPTextContent[];
  isError?: boolean;
}

export class MealPlanningWorkflow implements BaseWorkflow {
  readonly type = WorkflowType.MEAL_PLANNING;
  readonly graph: any;
  private client: Client;
  private llm: any;
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
    
    // Connect to MCP server
    const transport = new StdioClientTransport({
      command: "node",
      args: ["/Users/bradcarter/Documents/Dev/meal-planner/scripts/start-mcp.js", isCodex ? "--codex" : ""]
    });

    await this.client.connect(transport);

    // Initialize LLM
    this.llm = isCodex 
      ? new FakeChatModel({})
      : new ChatOpenAI({ 
          temperature: 0,
          modelName: "gpt-4o-mini"
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
    // Create a simple graph representation for now
    // This will be properly implemented when LangGraph types are compatible
    return {
      invoke: async (input: any, config: any) => {
        // Simple linear execution for Phase 2
        console.log(`🍽️ [MEAL-WORKFLOW] Executing workflow with input:`, input);
        
        // Execute workflow steps in sequence
        let state: Partial<MealPlanningState> = {
          thread_id: config?.configurable?.thread_id || 'default',
          workflow_type: WorkflowType.MEAL_PLANNING,
          participants: ['brad'],
          created_at: new Date(),
          updated_at: new Date(),
          current_step: MealPlanningStep.INITIATE,
          meal_plan: null,
          feedback_history: [],
          iteration_count: 0,
          shopping_list: null,
          is_finalized: false
        };

        // Execute each step
        state = { ...state, ...(await this.initiateNode(state as MealPlanningState)) };
        state = { ...state, ...(await this.generatePlanNode(state as MealPlanningState)) };
        state = { ...state, ...(await this.optimizePlanNode(state as MealPlanningState)) };
        state = { ...state, ...(await this.presentPlanNode(state as MealPlanningState)) };
        state = { ...state, ...(await this.finalizePlanNode(state as MealPlanningState)) };
        state = { ...state, ...(await this.generateShoppingListNode(state as MealPlanningState)) };
        state = { ...state, ...(await this.completeNode(state as MealPlanningState)) };

        return state;
      }
    };
  }

  // Node implementations
  private async initiateNode(state: MealPlanningState): Promise<Partial<MealPlanningState>> {
    console.log(`🍽️ [MEAL-WORKFLOW] Initiating meal planning for thread ${state.thread_id}`);
    
    return {
      current_step: MealPlanningStep.GENERATE_PLAN,
      meal_plan: null,
      feedback_history: [],
      iteration_count: 0,
      shopping_list: null,
      is_finalized: false,
      updated_at: new Date()
    };
  }

  private async generatePlanNode(state: MealPlanningState): Promise<Partial<MealPlanningState>> {
    console.log(`🍽️ [MEAL-WORKFLOW] Generating initial meal plan`);
    
    try {
      // Generate meal plan using MCP tool
      const planResult = await this.client.callTool({
        name: 'generateMealPlan',
        arguments: {}
      });

      const backendPlan = JSON.parse((planResult as MCPToolResult).content[0].text);
      const mealPlan = this.transformBackendPlan(backendPlan);

      return {
        current_step: MealPlanningStep.OPTIMIZE_PLAN,
        meal_plan: mealPlan,
        updated_at: new Date()
      };
    } catch (error) {
      console.error(`❌ [MEAL-WORKFLOW] Error generating plan:`, error);
      throw error;
    }
  }

  private async optimizePlanNode(state: MealPlanningState): Promise<Partial<MealPlanningState>> {
    console.log(`🍽️ [MEAL-WORKFLOW] Optimizing meal plan (iteration ${state.iteration_count + 1})`);
    
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
      updated_at: new Date()
    };
  }

  private async presentPlanNode(state: MealPlanningState): Promise<Partial<MealPlanningState>> {
    console.log(`🍽️ [MEAL-WORKFLOW] Presenting meal plan to participants`);
    
    if (!state.meal_plan) {
      throw new Error("No meal plan to present");
    }

    // Format plan for presentation
    const planPresentation = this.formatPlanForPresentation(state.meal_plan);
    console.log(`📋 [MEAL-PLAN]\n${planPresentation}`);
    
    // Check if we have recent feedback that requires processing
    const recentFeedback = state.feedback_history.filter(
      f => f.meal_plan_version === state.iteration_count
    );

    return {
      current_step: MealPlanningStep.AWAIT_FEEDBACK,
      updated_at: new Date()
    };
  }

  private async awaitFeedbackNode(state: MealPlanningState): Promise<Partial<MealPlanningState>> {
    console.log(`🍽️ [MEAL-WORKFLOW] Awaiting feedback from participants`);
    
    // This is a human-in-the-loop node
    // In a real implementation, this would wait for actual user input
    // For now, we'll simulate with a timeout or check for existing feedback
    
    return {
      current_step: MealPlanningStep.AWAIT_FEEDBACK,
      updated_at: new Date()
    };
  }

  private async processFeedbackNode(state: MealPlanningState): Promise<Partial<MealPlanningState>> {
    console.log(`🍽️ [MEAL-WORKFLOW] Processing feedback`);
    
    const feedbackAnalysis = await this.feedbackHandler.processFeedback(
      state.thread_id, 
      state.iteration_count
    );

    if (!feedbackAnalysis.requiresChanges) {
      console.log(`✅ [MEAL-WORKFLOW] Feedback is positive, finalizing plan`);
      return {
        current_step: MealPlanningStep.FINALIZE_PLAN,
        updated_at: new Date()
      };
    }

    console.log(`📋 [MEAL-WORKFLOW] Feedback requires changes: ${feedbackAnalysis.suggestions.join(', ')}`);
    
    return {
      current_step: MealPlanningStep.OPTIMIZE_PLAN,
      updated_at: new Date()
    };
  }

  private async finalizePlanNode(state: MealPlanningState): Promise<Partial<MealPlanningState>> {
    console.log(`🍽️ [MEAL-WORKFLOW] Finalizing meal plan`);
    
    if (!state.meal_plan) {
      throw new Error("No meal plan to finalize");
    }

    // Save the meal plan using MCP tool
    try {
      await this.client.callTool({
        name: 'finalizeMealPlan',
        arguments: { mealPlan: state.meal_plan }
      });

      console.log(`✅ [MEAL-WORKFLOW] Meal plan saved successfully`);
    } catch (error) {
      console.warn(`⚠️ [MEAL-WORKFLOW] Could not save meal plan:`, error);
      // Continue anyway as this is not critical for the workflow
    }

    return {
      current_step: MealPlanningStep.GENERATE_SHOPPING_LIST,
      is_finalized: true,
      updated_at: new Date()
    };
  }

  private async generateShoppingListNode(state: MealPlanningState): Promise<Partial<MealPlanningState>> {
    console.log(`🍽️ [MEAL-WORKFLOW] Generating shopping list`);
    
    if (!state.meal_plan) {
      throw new Error("No meal plan for shopping list generation");
    }

    try {
      // Extract meal IDs from the meal plan
      const mealIds = state.meal_plan.days
        .map(day => day.meal.id)
        .filter((id, index, self) => self.indexOf(id) === index); // Deduplicate

      console.log(`🛒 [MEAL-WORKFLOW] Generating shopping list for meal IDs:`, mealIds);

      // Call the MCP tool directly with proper typing
      const result = await this.client.callTool({
        name: 'generateShoppingList',
        arguments: { plan: mealIds }
      }) as MCPToolResultType;

      if (result.isError) {
        const errorContent = Array.isArray(result.content) && result.content[0]?.type === 'text' 
          ? result.content[0].text 
          : 'Unknown error';
        throw new Error(`MCP tool error: ${errorContent}`);
      }

      // Parse the response with proper type checking
      const responseText = Array.isArray(result.content) && result.content[0]?.type === 'text'
        ? result.content[0].text
        : '[]';
      
      console.log('🛒 [DEBUG] Raw shopping list response:', responseText);
      const shoppingList = JSON.parse(responseText) as ShoppingListResponse;
      console.log('🛒 [DEBUG] Parsed shopping list:', JSON.stringify(shoppingList, null, 2));
      
      console.log(`✅ [MEAL-WORKFLOW] Generated shopping list with ${shoppingList.length} items`);
      
      // Display the shopping list in a nice format
      console.log('\n🛍️  SHOPPING LIST 🛒');
      console.log('===================');
      
      if (!Array.isArray(shoppingList) || shoppingList.length === 0) {
        console.log('\nNo items in shopping list');
        return {
          current_step: MealPlanningStep.COMPLETE,
          shopping_list: [],
          updated_at: new Date()
        };
      }
      
      try {
        // Group items by category if available
        const groupedItems = shoppingList.reduce((acc: Record<string, ShoppingListItem[]>, item) => {
          if (!item || typeof item !== 'object') {
            console.warn('Skipping invalid shopping list item:', item);
            return acc;
          }
          
          const category = (item.category && typeof item.category === 'string') ? item.category : 'Other';
          const ingredient = (item.ingredient && typeof item.ingredient === 'string') ? item.ingredient : 'Unknown ingredient';
          const quantity = (item.quantity && typeof item.quantity === 'string') ? item.quantity : 'Some';
          
          if (!acc[category]) {
            acc[category] = [];
          }
          
          acc[category].push({
            ingredient,
            quantity,
            category
          });
          
          return acc;
        }, {});
        
        // Display items by category
        for (const [category, items] of Object.entries(groupedItems)) {
          console.log(`\n${category.toUpperCase()}:`);
          (items as ShoppingListItem[]).forEach(item => {
            console.log(`- ${item.quantity} ${item.ingredient}`);
          });
        }
        
        console.log('\nHappy shopping! 🛒');
        console.log('===================\n');
      } catch (error) {
        console.error('❌ Error formatting shopping list:', error);
        // Fallback: display raw data if formatting fails
        console.log('\nRaw shopping list data:');
        console.log(JSON.stringify(shoppingList, null, 2));
      }

      return {
        current_step: MealPlanningStep.COMPLETE,
        shopping_list: shoppingList,
        updated_at: new Date()
      };
    } catch (error) {
      console.error(`❌ [MEAL-WORKFLOW] Error generating shopping list:`, error);
      // Continue with empty shopping list on error
      return {
        current_step: MealPlanningStep.COMPLETE,
        shopping_list: [],
        _error: error instanceof Error ? error.message : 'Failed to generate shopping list',
        updated_at: new Date()
      };
    }
  }

  private async completeNode(state: MealPlanningState): Promise<Partial<MealPlanningState>> {
    console.log(`🍽️ [MEAL-WORKFLOW] Meal planning workflow completed`);
    
    // Final validation
    const finalIssues = state.meal_plan ? this.validatePlan(state.meal_plan) : [];
    if (finalIssues.length > 0) {
      console.warn(`⚠️ [MEAL-WORKFLOW] Final plan has issues:`, finalIssues);
    }

    return {
      current_step: MealPlanningStep.COMPLETE,
      updated_at: new Date()
    };
  }

  // Helper methods
  private shouldProcessFeedback(state: MealPlanningState): string {
    const recentFeedback = state.feedback_history.filter(
      f => f.meal_plan_version === state.iteration_count
    );

    // If we have feedback or haven't reached max iterations, process it
    if (recentFeedback.length > 0 && state.iteration_count < 3) {
      return "process_feedback";
    }

    return "finalize_plan";
  }

  private validatePlan(plan: WeeklyMealPlan): string[] {
    const issues: string[] = [];
    
    // Check consecutive high-effort meals
    let consecutiveHighEffort = 0;
    for (const day of plan.days) {
      if (day.meal.effort > 3) {
        consecutiveHighEffort++;
        if (consecutiveHighEffort > VALIDATION_CRITERIA.maxConsecutiveHighEffort) {
          issues.push(`Too many consecutive high-effort meals (day ${day.dayIndex})`);
        }
      } else {
        consecutiveHighEffort = 0;
      }
    }

    // Check red meat count
    const redMeatCount = plan.days.filter(d => d.meal.hasRedMeat).length;
    if (redMeatCount > VALIDATION_CRITERIA.maxRedMeatPerWeek) {
      issues.push(`Too many red meat meals: ${redMeatCount} (max ${VALIDATION_CRITERIA.maxRedMeatPerWeek})`);
    }

    // Check for duplicates
    const mealIds = plan.days.map(d => d.meal.id);
    const duplicates = mealIds.filter((id, index) => mealIds.indexOf(id) !== index);
    if (duplicates.length > 0) {
      issues.push(`Duplicate meals found: ${duplicates.join(', ')}`);
    }

    return issues;
  }

  private transformBackendPlan(backendPlan: any): WeeklyMealPlan {
    const days = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner'] as const;
    
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
              meal: {
                id: meal.id,
                name: meal.mealName,
                effort: meal.relativeEffort,
                hasRedMeat: meal.redMeat
              }
            });
          }
        }
      }
    }
    
    return { days };
  }

  private async optimizePlanWithLLM(plan: WeeklyMealPlan, issues: string[]): Promise<WeeklyMealPlan> {
    // Fetch available meals
    const mealsResp = await this.client.callTool({
      name: 'getMeals',
      arguments: {}
    });
    const availableMeals: any[] = JSON.parse((mealsResp as MCPToolResult).content[0].text);

    // Create concise meal options for the prompt
    const mealOptions = availableMeals.map(m => 
      `${m.id}: ${m.mealName} (${m.mealType}, effort: ${m.relativeEffort}, red meat: ${m.redMeat})`
    ).join('\n');

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const planDescription = plan.days.map(day => 
      `${dayNames[day.dayIndex]} ${day.mealType}: ${day.meal.name} (ID: ${day.meal.id}, effort: ${day.meal.effort}, red meat: ${day.meal.hasRedMeat})`
    ).join('\n');

    const prompt = `You are optimizing a weekly meal plan. Here are the current issues:
${issues.join('\n')}

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
If no replacements are needed, return: {"replacements": []}`;

    const result = await this.llm.invoke([{ role: "user", content: prompt }]);
    const llmResponse = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    
    // Parse and apply recommendations
    let optimizedPlan = { ...plan, days: [...plan.days] };
    
    try {
      const recommendations = JSON.parse(llmResponse);
      
      if (recommendations.replacements && Array.isArray(recommendations.replacements)) {
        for (const replacement of recommendations.replacements) {
          const { day, mealType, oldMealId, newMealId, reason } = replacement;
          const dayIndex = dayNames.indexOf(day);
          const newMeal = availableMeals.find(m => m.id === newMealId);
          
          if (dayIndex >= 0 && newMeal && newMeal.mealType === mealType) {
            console.log(`🤖 [MEAL-WORKFLOW] Applying optimization: Replace ${day} ${mealType} (ID ${oldMealId}) with ${newMeal.mealName} (ID ${newMealId}) - ${reason}`);
            
            optimizedPlan.days = optimizedPlan.days.map(planDay => {
              if (planDay.dayIndex === dayIndex && planDay.mealType === mealType) {
                return {
                  ...planDay,
                  meal: {
                    id: newMeal.id,
                    name: newMeal.mealName,
                    effort: newMeal.relativeEffort,
                    hasRedMeat: newMeal.redMeat
                  }
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
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const lines: string[] = [];
    
    lines.push("📅 Weekly Meal Plan:");
    lines.push("=" .repeat(50));
    
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const dayMeals = plan.days.filter(d => d.dayIndex === dayIndex);
      if (dayMeals.length > 0) {
        lines.push(`\n${dayNames[dayIndex]}:`);
        for (const dayMeal of dayMeals) {
          const effort = "🔥".repeat(dayMeal.meal.effort);
          const redMeat = dayMeal.meal.hasRedMeat ? "🥩" : "";
          lines.push(`  ${dayMeal.mealType}: ${dayMeal.meal.name} ${effort} ${redMeat}`);
        }
      }
    }
    
    return lines.join('\n');
  }
}