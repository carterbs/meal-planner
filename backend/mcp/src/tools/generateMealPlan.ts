import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { API } from '../utils.js';
import type { WeeklyMealPlan } from '../resources/weeklyMealPlan.js';

export async function generateMealPlan() {
  const resp = await fetch(`${API}/api/mealplan/generate`, { method: "POST" });
  if (!resp.ok) { throw new McpError(-32000, `BackendError: ${resp.statusText}`); }
  return (await resp.json()) as WeeklyMealPlan;
}

export function registerGenerateMealPlan(server: McpServer) {
  server.tool(
    'generateMealPlan',
    null,
    async () => {
      const json = await generateMealPlan();
      return { content: [{ type: "json", json }] };
    }
  );
}
