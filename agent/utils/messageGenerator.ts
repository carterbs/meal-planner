import { ChatOpenAI } from '@langchain/openai';
import { debugLog } from '../cli';
import { WeeklyMealPlan } from '../shared/types';

export class MessageGenerator {
  private llm: ChatOpenAI;

  constructor() {
    this.llm = new ChatOpenAI({
      temperature: 0.7,
      modelName: 'gpt-4.1-nano',
    });
  }

  /**
   * Generate a contextual message for workflow resumption
   */
  async generateResumeMessage(context: {
    currentStep?: string;
    workflowType?: string;
    hasRecentFeedback?: boolean;
    feedbackSummary?: string;
    mealPlan?: WeeklyMealPlan;
    shoppingList?: string[];
    iteration?: number;
    previousMealPlan?: WeeklyMealPlan;
  }): Promise<string> {
    try {
      let mealPlanSummary = '';
      if (context.mealPlan?.days) {
        const mealCount = context.mealPlan.days.length;
        const uniqueDays = new Set(context.mealPlan.days.map((d) => d.dayIndex))
          .size;
        const sampleMeals = context.mealPlan.days
          .map((d) => d.meal?.name)
          .filter((name): name is string => Boolean(name))
          .slice(0, 3);
        mealPlanSummary = `Current meal plan has ${mealCount} meals across ${uniqueDays} days. Sample meals: ${sampleMeals.join(', ')}`;
      }

      let shoppingListSummary = '';
      if (context.shoppingList && context.shoppingList.length > 0) {
        shoppingListSummary = `Shopping list has ${context.shoppingList.length} items including: ${context.shoppingList.slice(0, 5).join(', ')}${context.shoppingList.length > 5 ? '...' : ''}`;
      }

      const prompt = `Generate a brief, friendly message (1-2 sentences) for a meal planning assistant that has just resumed processing a user's request. Be conversational, helpful, and reference specific details from the meal plan when possible.

Context:
- Current step: ${context.currentStep || 'unknown'}
- Workflow type: ${context.workflowType || 'meal_planning'}
- Has recent feedback: ${context.hasRecentFeedback ? 'yes' : 'no'}
- Iteration: ${context.iteration || 1}
${context.feedbackSummary ? `- Recent feedback: ${context.feedbackSummary}` : ''}
${mealPlanSummary ? `- Meal plan: ${mealPlanSummary}` : ''}
${shoppingListSummary ? `- Shopping list: ${shoppingListSummary}` : ''}

Generate a message that:
1. References specific meals or details from the current plan when relevant
2. Indicates what the assistant is working on or has completed
3. Sounds natural and conversational

Examples:
- "I've swapped out the Frozen Pizza on Thursday for Sushi instead. Let me know if there's any other changes that you'd like to make."
- "Got it! I swapped out Marry Me Chicken for a much simpler Potato Chip Fritata."
- "I've updated the plan - you now have Honey Nut Cheerios on Tuesday and Bagels with Cream cheese on Wednesday."

Your Response (just the message, no quotes or formatting):`;

      const result = await this.llm.invoke([{ role: 'user', content: prompt }]);
      const message =
        typeof result.content === 'string'
          ? result.content
          : String(result.content);

      debugLog(`[MESSAGE_GENERATOR] Generated message: ${message}`);
      return message.trim();
    } catch (error) {
      debugLog(`[MESSAGE_GENERATOR] Error generating message: ${error}`);
      // Fallback to generic message
      return "I'm working on your meal plan now!";
    }
  }

  /**
   * Generate a message for workflow completion
   */
  async generateCompletionMessage(context: {
    workflowType?: string;
    mealPlan?: WeeklyMealPlan;
    shoppingList?: string[];
  }): Promise<string> {
    try {
      let mealPlanDetails = '';
      if (context.mealPlan?.days) {
        const mealCount = context.mealPlan.days.length;
        const uniqueDays = new Set(context.mealPlan.days.map((d) => d.dayIndex))
          .size;
        const featuredMeals = context.mealPlan.days
          .map((d) => (d.meal && d.meal.effort >= 3 ? d.meal.name : undefined))
          .filter((name): name is string => Boolean(name))
          .slice(0, 2);
        mealPlanDetails = `${mealCount} meals across ${uniqueDays} days${featuredMeals.length > 0 ? `, featuring ${featuredMeals.join(' and ')}` : ''}`;
      }

      let shoppingDetails = '';
      if (context.shoppingList && context.shoppingList.length > 0) {
        shoppingDetails = `shopping list with ${context.shoppingList.length} items`;
      }

      const prompt = `Generate a brief, friendly completion message (1-2 sentences) for a meal planning assistant that has finished creating a meal plan and shopping list. Reference specific details when possible.

Context:
- Workflow type: ${context.workflowType || 'meal_planning'}  
- Meal plan: ${mealPlanDetails || 'meal plan created'}
- Shopping list: ${shoppingDetails || 'shopping list created'}

Generate a message that:
1. Celebrates the completion
2. References specific details from the actual meal plan
3. Mentions the shopping list if available
4. Sounds natural and helpful
5. Invites further interaction or feedback

Examples:
- "Your meal plan is ready! I've planned 14 meals across 7 days, featuring Slow-Cooker BBQ Pulled Chicken and Apple Cheddar Chicken Burgers, plus a shopping list with 25 items."
- "All set! Your personalized meal plan includes everything from easy Honey Nut Cheerios breakfasts to hearty Steak dinners, and I've organized your shopping list too."
- "Perfect! I've put together a great week of meals including some delicious pasta dishes and quick breakfast options, plus your complete shopping list."

Response (just the message, no quotes or formatting):`;

      const result = await this.llm.invoke([{ role: 'user', content: prompt }]);
      const message =
        typeof result.content === 'string'
          ? result.content
          : String(result.content);

      debugLog(`[MESSAGE_GENERATOR] Generated completion message: ${message}`);
      return message.trim();
    } catch (error) {
      debugLog(
        `[MESSAGE_GENERATOR] Error generating completion message: ${error}`,
      );
      // Fallback to generic message
      return 'Your meal plan is ready!';
    }
  }
}
