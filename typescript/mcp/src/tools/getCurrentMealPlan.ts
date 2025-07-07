import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { API } from '../utils.js';
import type { WeeklyMealPlan } from '@mealplanner/generated';

export async function doGetCurrentMealPlan(): Promise<WeeklyMealPlan> {
  const resp = await fetch(`${API}/api/mealplan`);
  if (!resp.ok) {
    throw new McpError(-32000, `BackendError: ${resp.statusText}`);
  }
  return resp.json();
}

export function registerGetCurrentMealPlan(server: McpServer) {
  server.tool(
    'getCurrentMealPlan',
    'Get the current weekly meal plan showing all scheduled meals by day and type (breakfast/lunch/dinner). Provides context for understanding what meals are currently planned and which ones might need replacement.',
    async () => {
      const mealPlan = await doGetCurrentMealPlan();
      return {
        content: [{ type: 'text', text: JSON.stringify(mealPlan, null, 2) }]
      };
    }
  );
}