import { debugLog, infoLog, warnLog, errorLog } from "../logging.js";
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { API, retryFetch } from '../utils.js';
import { GenerateMealPlanResponse, MealSlot } from '@mealplanner/generated';

function describeMealSlot(slot: MealSlot | string | undefined): string {
  if (typeof slot === 'number') {
    const name = MealSlot[slot];
    return name ? `MEAL_SLOT_${name}` : `${slot}`;
  }
  return slot ?? 'MEAL_SLOT_UNSPECIFIED';
}
export async function generateMealPlan(): Promise<GenerateMealPlanResponse> {
    await infoLog(`🔧 [MCP-FETCH] About to fetch: ${API}/api/mealplan/generate`);
    await infoLog(`🔧 [MCP-FETCH] API variable: ${API}`);
    await infoLog(`🔧 [MCP-FETCH] BACKEND_BASE_URL env: ${process.env.BACKEND_BASE_URL || 'NOT_SET'}`);
    try {

        const resp = await retryFetch(`${API}/api/mealplan/generate`, { method: "POST" });
        await infoLog(`🔧 [MCP-FETCH] Response status: ${resp.status} ${resp.statusText}`);
        await infoLog(`🔧 [MCP-FETCH] Response ok: ${resp.ok}`);
        if (!resp.ok) {
            const errorText = await resp.text();
            await errorLog(`🔧 [MCP-FETCH] Error response body: ${errorText}`);
            throw new McpError(-32000, `BackendError: ${resp.statusText}`);
        }
        const responseJson = await resp.json() as GenerateMealPlanResponse;
        await infoLog(`🔧 [MCP-FETCH] Successfully parsed JSON response`);
        await infoLog("MEAL PLAN from backend-------");
        await infoLog(JSON.stringify(responseJson));
        // DEBUGGING: Log dayIndex values from backend response
        await infoLog("🔍 [MCP] Checking dayIndex values from backend:");
        if (responseJson.plan?.items) {
            for (let i = 0; i < responseJson.plan.items.length; i++) {
                const item = responseJson.plan.items[i];
                await infoLog(`🔍 [MCP] Entry ${i}: dayIndex=${item.dayIndex}, mealType=${describeMealSlot(item.mealType)}, meal=${item.mealSnapshot?.name || 'nil'}`);
            }
        }
        return responseJson;
    }
    catch (error) {
        await errorLog(`🔧 [MCP-FETCH] Fetch failed with error: ${error}`);
        await errorLog(`🔧 [MCP-FETCH] Error details: ${JSON.stringify(error)}`);
        throw new McpError(-32000, `fetch failed: ${error}`);
    }
}
export function registerGenerateMealPlan(server: McpServer) {
    server.tool('generateMealPlan', 'Generate a new weekly meal plan with automatically selected recipes based on effort preferences and red meat consumption limits. This creates a complete 7-day meal plan.', async () => {
        const json = await generateMealPlan();
        return {
            content: [{ type: "text", text: JSON.stringify(json, null, 2) }]
        };
    });
}
