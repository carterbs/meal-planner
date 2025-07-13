import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { API } from '../utils.js';
import { ReplaceMealRequest, ReplaceMealResponse, WeeklyMealPlan } from '@mealplanner/generated';

export const replaceArgs = z.object({
  day: z.string().describe("Day to replace (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday)"),
  mealType: z.enum(['breakfast', 'lunch', 'dinner']).describe("Which meal type to replace"),
  newMealId: z.number().int().positive().describe("ID of the replacement meal")
});

export async function doReplaceMeal(day: string, mealType: string, newMealId: number): Promise<ReplaceMealResponse> {
  const resp = await fetch(`${API}/api/mealplan/replace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ReplaceMealRequest.fromJSON({ day, mealType, newMealId }))
  });
  if (!resp.ok) {
    throw new McpError(-32000, `BackendError: ${resp.statusText}`);
  }
  return ReplaceMealResponse.fromJSON(await resp.json());
}

export function registerReplaceMeal(server: McpServer) {
  server.tool(
    'replaceMeal',
    'Replace a specific meal in the weekly meal plan. Use this after analyzing available meals and current plan to make an intelligent substitution. Consider effort levels (Monday: 0-2, Tue-Thu/Sat: 3-5, Sunday: 6-100), red meat limits (max 1 per week), and meal type compatibility.',
    {
      day: replaceArgs.shape.day,
      mealType: replaceArgs.shape.mealType,
      newMealId: replaceArgs.shape.newMealId
    },
    async ({ day, mealType, newMealId }) => {
      const json = await doReplaceMeal(day, mealType, newMealId);
      return {
        content: [{ type: 'text', text: JSON.stringify(json, null, 2) }]
      };
    }
  );
}
