import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { API } from '../utils.js';
import type { WeeklyMealPlan } from '../resources/weeklyMealPlan.js';

export const replaceArgs = z.object({
  dayIndex: z.number().int().min(0).max(6).describe("Day of the week to replace meal for (0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday)"),
  newMealId: z.number().int().positive().describe("The unique ID of the new recipe to use for this day")
});

export async function doReplaceMeal(dayIndex: number, newMealId: number): Promise<WeeklyMealPlan> {
  const resp = await fetch(`${API}/api/mealplan/replace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dayIndex, newMealId })
  });
  if (!resp.ok) {
    throw new McpError(-32000, `BackendError: ${resp.statusText}`);
  }
  return resp.json();
}

export function registerReplaceMeal(server: McpServer) {
  server.tool(
    'replaceMeal',
    {
      dayIndex: replaceArgs.shape.dayIndex,
      newMealId: replaceArgs.shape.newMealId
    },
    async ({ dayIndex, newMealId }) => {
      const json = await doReplaceMeal(dayIndex, newMealId);
      return {
        content: [{ type: 'text', text: JSON.stringify(json, null, 2) }]
      };
    }
  );
}
