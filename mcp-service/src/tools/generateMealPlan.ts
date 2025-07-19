import { debugLog, infoLog, warnLog, errorLog } from "../logging.js";
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { API, retryFetch } from '../utils.js';
import { WeeklyMealPlan, GenerateMealPlanResponse } from '@mealplanner/generated';

export async function generateMealPlan(): Promise<GenerateMealPlanResponse> {
  await infoLog(`🔧 [MCP-FETCH] About to fetch: ${API}/api/mealplan/generate`);
  await infoLog(`🔧 [MCP-FETCH] API variable: ${API}`);
  await infoLog(`🔧 [MCP-FETCH] BACKEND_BASE_URL env: ${process.env.BACKEND_BASE_URL || 'NOT_SET'}`);
  
  try {
    // First, try to reach the health endpoint to test connectivity
    await infoLog(`🔧 [MCP-FETCH] Checking BE health`);
    await infoLog(`🔧 [MCP-FETCH] Node.js version: ${process.version}`);
    await infoLog(`🔧 [MCP-FETCH] Process platform: ${process.platform}`);
    await infoLog(`🔧 [MCP-FETCH] Full URL being fetched: ${API}/api/health`);
    
    // Test basic connectivity by trying to resolve localhost first
    try {
      const dns = await import('dns');
      const { promisify } = await import('util');
      const lookup = promisify(dns.lookup);
      const result = await lookup('localhost');
      await infoLog(`🔧 [MCP-FETCH] DNS lookup localhost: ${JSON.stringify(result)}`);
    } catch (dnsError) {
      await errorLog(`🔧 [MCP-FETCH] DNS lookup failed: ${dnsError}`);
    }
    
    const healthResp = await retryFetch(`${API}/api/health`, { method: "GET" });
    await infoLog(`🔧 [MCP-FETCH] Health check status: ${healthResp.status} ${healthResp.statusText}`);
    
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
    if (responseJson.plan?.days) {
      for (let i = 0; i < responseJson.plan.days.length; i++) {
        const day = responseJson.plan.days[i];
        await infoLog(`🔍 [MCP] Entry ${i}: dayIndex=${day.dayIndex}, mealType=${day.mealType}, meal=${day.meal?.name || 'nil'}`);
      }
    }

    return responseJson;
  } catch (error) {
    await errorLog(`🔧 [MCP-FETCH] Fetch failed with error: ${error}`);
    await errorLog(`🔧 [MCP-FETCH] Error details: ${JSON.stringify(error)}`);
    throw new McpError(-32000, `fetch failed: ${error}`);
  }
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