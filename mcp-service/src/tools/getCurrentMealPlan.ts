import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { API } from '../utils.js';
import { MealPlan, GetMealPlanResponse } from '@mealplanner/generated';

export async function doGetCurrentMealPlan(): Promise<MealPlan> {
  const resp = await fetch(`${API}/api/mealplan`);
  if (!resp.ok) {
    throw new McpError(-32000, `BackendError: ${resp.statusText}`);
  }
  const responseJson = await resp.json();
  const data = GetMealPlanResponse.fromJson(responseJson);
  if (!data.plan) {
    throw new McpError(-32000, 'No meal plan returned from backend');
  }
  return data.plan;
}

export function registerGetCurrentMealPlan(server: McpServer) {
  server.tool(
    'getCurrentMealPlan',
    'Get the current meal plan showing slot assignments (status, version, and meal snapshots) for the active week. Provides context for which meals are currently planned.',
    async () => {
      const mealPlan = await doGetCurrentMealPlan();
      return {
        content: [{ type: 'text', text: JSON.stringify(mealPlan, null, 2) }],
      };
    },
  );
}
