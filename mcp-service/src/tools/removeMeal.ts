import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { MealPlan, MealPlanItem, MealSlot } from '@mealplanner/generated';
import type { JsonValue } from '@bufbuild/protobuf';

function normalizeMealType(mealType: string): MealSlot {
  const normalized = mealType.toLowerCase();
  switch (normalized) {
    case 'breakfast':
      return MealSlot.BREAKFAST;
    case 'lunch':
      return MealSlot.LUNCH;
    case 'dinner':
      return MealSlot.DINNER;
    default:
      throw new Error(`invalid mealType ${mealType}`);
  }
}

function clonePlan(plan: MealPlan): MealPlan {
  return MealPlan.fromJson(plan.toJson() as JsonValue, {
    ignoreUnknownFields: true,
  });
}

// Helper to perform the removal logic mirroring the backend implementation
function removeMealFromPlan(plan: MealPlan, dayIndex: number, mealType: string) {
  if (!plan) {
    throw new Error('plan is null or undefined');
  }
  if (dayIndex < 0 || dayIndex > 6) {
    throw new Error(`invalid dayIndex ${dayIndex}`);
  }
  const slot = normalizeMealType(mealType);
  const index = plan.items.findIndex(
    (item) => item.dayIndex === dayIndex && item.mealType === slot,
  );
  if (index === -1) {
    throw new Error('meal not found for specified dayIndex and mealType');
  }
  const entry = plan.items[index];
  if (!entry.mealSnapshot) {
    throw new Error('meal already empty');
  }
  plan.items[index] = new MealPlanItem({
    id: entry.id,
    mealPlanId: entry.mealPlanId,
    dayIndex: entry.dayIndex,
    mealType: entry.mealType,
    mealId: undefined,
    mealSnapshot: undefined,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  });
}
export const removeMealArgs = z.object({
    plan: z.any().describe('Current MealPlan object'),
    dayIndex: z.number().describe('Index of the day to remove meal from (0=Monday, 1=Tuesday, ..., 5=Saturday, 6=Sunday)'),
    mealType: z.enum(['breakfast', 'lunch', 'dinner']).describe('Type of meal to remove')
});
export function doRemoveMeal(plan: MealPlan, dayIndex: number, mealType: string): MealPlan {
  try {
    if (plan == null) {
      throw new Error('plan is null or undefined');
    }
    const typedPlan =
      plan instanceof MealPlan
        ? plan
        : MealPlan.fromJson(plan as unknown as JsonValue, {
            ignoreUnknownFields: true,
          });
    const clonedPlan = clonePlan(typedPlan);
    removeMealFromPlan(clonedPlan, dayIndex, mealType);
    return clonedPlan;
  } catch (err: any) {
    throw new McpError(-32000, `RemoveMealError: ${err.message}`);
  }
}
export function registerRemoveMeal(server: McpServer) {
    server.tool('removeMeal', 'Remove a specific meal from the current meal plan session', {
        plan: removeMealArgs.shape.plan,
        dayIndex: removeMealArgs.shape.dayIndex,
        mealType: removeMealArgs.shape.mealType
    }, async ({ plan, dayIndex, mealType }) => {
        const result = doRemoveMeal(plan as MealPlan, dayIndex, mealType);
        return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
    });
}
