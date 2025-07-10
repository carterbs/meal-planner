import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { API } from '../utils.js';
import { WeeklyMealPlan, GenerateMealPlanResponse } from '@mealplanner/generated';

export async function generateMealPlan() {
  const resp = await fetch(`${API}/api/mealplan/generate`, { method: "POST" });
  if (!resp.ok) { throw new McpError(-32000, `BackendError: ${resp.statusText}`); }
  const responseJson = await resp.json();
  console.log("MEAL PLAN from mcp generate-------")
  console.log(responseJson)
  
  const data = GenerateMealPlanResponse.fromJSON(responseJson);
  if (!data.plan) {
    throw new McpError(-32000, 'No meal plan returned from backend');
  }
  return data.plan;
}

export function registerGenerateMealPlan(server: McpServer) {
  server.tool(
    'generateMealPlan',
    'Generate a new weekly meal plan with automatically selected recipes based on effort preferences and red meat consumption limits. This creates a complete 7-day meal plan.',
    async () => {
      const json = await generateMealPlan();
      return {
        content: [{ type: "text", text: JSON.stringify(json, null, 2) }]
      };
    }
  );
}
