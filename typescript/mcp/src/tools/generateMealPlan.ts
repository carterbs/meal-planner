import { debugLog, infoLog, warnLog, errorLog } from "../logging.js";
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { API } from '../utils.js';
import { WeeklyMealPlan, GenerateMealPlanResponse } from '@mealplanner/generated';

export async function generateMealPlan(): Promise<GenerateMealPlanResponse> {
  const resp = await fetch(`${API}/api/mealplan/generate`, { method: "POST" });
  if (!resp.ok) {throw new McpError(-32000, `BackendError: ${resp.statusText}`);}
  const responseJson = await resp.json() as GenerateMealPlanResponse;
  await infoLog("MEAL PLAN from backend-------");
  await infoLog(JSON.stringify(responseJson));

  // DEBUGGING: Log dayIndex values from backend response
  await infoLog("🔍 [MCP] Checking dayIndex values from backend:");
  if (responseJson.plan?.days) {
    for (let i = 0; i < responseJson.plan.days.length; i++) {
      const day = responseJson.plan.days[i];
      await infoLog(`🔍 [MCP] Entry ${i}: dayIndex=${day.dayIndex}, mealType=${day.mealType}, meal=${day.meal?.name || 'nil'}`);
    }
  }

  return responseJson;
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