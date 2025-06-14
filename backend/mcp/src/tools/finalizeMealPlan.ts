import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { API } from '../utils.js';

export async function finalizePlan() {
  const resp = await fetch(`${API}/api/mealplan/finalize`, { method: 'POST' });
  if (!resp.ok) {
    throw new McpError(-32000, `BackendError: ${resp.statusText}`);
  }
  return resp.json();
}

export function registerFinalizeMealPlan(server: McpServer) {
  server.tool('finalizeMealPlan', null, async () => {
    const json = await finalizePlan();
    return { content: [{ type: 'json', json }] };
  });
}
