import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { API } from '../utils.js';
import type { WeeklyMealPlan } from '../resources/weeklyMealPlan.js';

export const swapArgs = z.object({ 
  dayIndex: z.number().int().min(0).max(6).describe("Day of the week to swap meal for (0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday)")
});

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
  server.tool(
    'swapMeal',
    {
      dayIndex: swapArgs.shape.dayIndex
    },
    async ({ dayIndex }) => {
      const json = await doSwapMeal(dayIndex);
      return {
        content: [{ type: 'text', text: JSON.stringify(json, null, 2) }]
      };
    }
  );
}
