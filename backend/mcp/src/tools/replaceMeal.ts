import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { API } from '../utils.js';
import type { WeeklyMealPlan } from '../resources/weeklyMealPlan.js';

export const replaceArgs = z.object({
  dayIndex: z.number().int().min(0).max(6),
  newMealId: z.number().int().positive(),
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
  server.tool('replaceMeal', replaceArgs, async ({ dayIndex, newMealId }) => {
    const json = await doReplaceMeal(dayIndex, newMealId);
    return { content: [{ type: 'json', json }] };
  });
}
