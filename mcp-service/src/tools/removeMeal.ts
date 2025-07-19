import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { WeeklyMealPlan } from '@mealplanner/generated';

// Helper to perform the removal logic mirroring the backend implementation
function removeMealFromPlan(plan: WeeklyMealPlan, dayIndex: number, mealType: string) {
  if (!plan) {
    throw new Error('plan is null or undefined');
  }
  if (dayIndex < 0 || dayIndex > 6) {
    throw new Error(`invalid dayIndex ${dayIndex}`);
  }

  const mType = mealType.toLowerCase();
  if (!['breakfast', 'lunch', 'dinner'].includes(mType)) {
    throw new Error(`invalid mealType ${mealType}`);
  }

  const entry = plan.days.find((d) => d.dayIndex === dayIndex && d.mealType === mType);
  if (!entry) {
    throw new Error('meal not found for specified dayIndex and mealType');
  }
  if (!entry.meal) {
    throw new Error('meal already empty');
  }

  entry.meal = undefined as any; // set to undefined / null for protobuf compatibility
}

export const removeMealArgs = z.object({
  plan: z.any().describe('Current WeeklyMealPlan object'),
  dayIndex: z.number().describe('Index of the day to remove meal from (0=Monday, 1=Tuesday, ..., 5=Saturday, 6=Sunday)'),
  mealType: z.enum(['breakfast', 'lunch', 'dinner']).describe('Type of meal to remove')
});

export function doRemoveMeal(plan: WeeklyMealPlan, dayIndex: number, mealType: string): WeeklyMealPlan {
  try {
    // Deep clone to avoid mutating caller's object
    const clonedPlan: WeeklyMealPlan = JSON.parse(JSON.stringify(plan));
    removeMealFromPlan(clonedPlan, dayIndex, mealType);
    return clonedPlan;
  } catch (err: any) {
    throw new McpError(-32000, `RemoveMealError: ${err.message}`);
  }
}

export function registerRemoveMeal(server: McpServer) {
  server.tool(
    'removeMeal',
    'Remove a specific meal from the current meal plan session',
    {
      plan: removeMealArgs.shape.plan,
      dayIndex: removeMealArgs.shape.dayIndex,
      mealType: removeMealArgs.shape.mealType
    },
    async ({ plan, dayIndex, mealType }) => {
      const result = doRemoveMeal(plan as WeeklyMealPlan, dayIndex, mealType);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    }
  );
}
