import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { API } from '../utils.js';
import type { WeeklyMealPlan } from '../resources/weeklyMealPlan.js';

export const swapArgs = z.object({ 
  dayIndex: z.number().int().min(0).max(6).describe("Day of the week to swap meal for (0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday)")
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
    'Randomly swap a meal on a specific day with an alternative meal of the same type. Uses the backend\'s random meal selection to provide variety while maintaining meal type compatibility.',
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
