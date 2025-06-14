import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { API } from '../utils.js';
import type { WeeklyMealPlan } from '../resources/weeklyMealPlan.js';

export const swapArgs = z.object({ dayIndex: z.number().int().min(0).max(6) });

export async function doSwapMeal(dayIndex: number): Promise<WeeklyMealPlan> {
  const resp = await fetch(`${API}/api/meals/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dayIndex })
  });
  if (!resp.ok) {
    throw new McpError(-32000, `BackendError: ${resp.statusText}`);
  }
  return resp.json();
}

export function registerSwapMeal(server: McpServer) {
  server.tool('swapMeal', swapArgs, async ({ dayIndex }) => {
    const json = await doSwapMeal(dayIndex);
    return { content: [{ type: 'json', json }] };
  });
}
