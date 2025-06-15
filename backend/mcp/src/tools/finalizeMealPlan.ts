import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { API } from '../utils.js';

export async function finalizePlan() {
  const resp = await fetch(`${API}/api/mealplan/finalize`, { method: 'POST' });
  if (!resp.ok) {
    throw new McpError(-32000, `BackendError: ${resp.statusText}`);
  }
  return resp.text();
}

export function registerFinalizeMealPlan(server: McpServer) {
  server.tool(
    'finalizeMealPlan',
    'Finalize the current meal plan and make it the active meal plan. This commits the planned meals and makes them permanent until a new plan is generated.',
    async () => {
      const text = await finalizePlan();
      return {
        content: [{ type: 'text', text }]
      };
    }
  );
}
