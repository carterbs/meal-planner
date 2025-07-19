import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { API } from '../utils.js';
import { FinalizeMealPlanResponse } from '@mealplanner/generated';

export async function finalizePlan(mealPlan: any): Promise<FinalizeMealPlanResponse> {
  const requestBody = {
    plan: mealPlan
  };
  
  const resp = await fetch(`${API}/api/mealplan/finalize`, { 
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!resp.ok) {
    throw new McpError(-32000, `BackendError: ${resp.statusText}`);
  }
  const responseJson = await resp.json();
  return FinalizeMealPlanResponse.fromJson(responseJson)
}

export function registerFinalizeMealPlan(server: McpServer) {
  server.tool(
    'finalizeMealPlan',
    'Finalize the provided meal plan and make it the active meal plan. This commits the planned meals and makes them permanent until a new plan is generated.',
    {
      mealPlan: {
        description: 'The meal plan to finalize',
        type: 'object'
      }
    },
    async (args) => {
      const { mealPlan } = args as { mealPlan: any };
      const result = await finalizePlan(mealPlan);
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }]
      };
    }
  );
}
