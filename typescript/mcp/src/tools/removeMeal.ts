import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { API } from '../utils.js';
import { RemoveMealRequest } from '@mealplanner/generated';

export const removeMealArgs = z.object({
  threadId: z.string().describe('Agent session thread ID'),
  dayIndex: z.number().describe('Index of the day to remove meal from (0=Monday, 1=Tuesday, ..., 5=Saturday, 6=Sunday)'),
  mealType: z.enum(['breakfast', 'lunch', 'dinner']).describe('Type of meal to remove')
});

export async function doRemoveMeal(threadId: string, dayIndex: number, mealType: string): Promise<any> {
  const resp = await fetch(`${API}/api/meals/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },    
    body: JSON.stringify(RemoveMealRequest.fromJSON({ threadId, dayIndex, mealType }))
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new McpError(-32000, `BackendError: ${resp.status} ${errText}`);
  }
  return resp.json();
}

export function registerRemoveMeal(server: McpServer) {
  server.tool(
    'removeMeal',
    'Remove a specific meal from the current meal plan session',
    {
      threadId: removeMealArgs.shape.threadId,
      dayIndex: removeMealArgs.shape.dayIndex,
      mealType: removeMealArgs.shape.mealType
    },
    async ({ threadId, dayIndex, mealType }) => {
      const result = await doRemoveMeal(threadId, dayIndex, mealType);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    }
  );
}
