import { infoLog, warnLog, errorLog } from "../logging.js";
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { API } from '../utils.js';
import { GetShoppingListRequest, GetShoppingListResponse, ShoppingListItem } from '@mealplanner/generated';

export type ShoppingList = ShoppingListItem[];

export async function generateList(plan: number[]): Promise<GetShoppingListResponse> {
  try {
    await infoLog(`🛒 [MCP] Generating shopping list for plan: ${plan}`);
    const resp = await fetch(`${API}/api/shoppinglist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(new GetShoppingListRequest({ plan }))
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      throw new McpError(
        -32000,
        `BackendError: ${resp.status} ${resp.statusText} - ${errorData.message || 'Unknown error'}`
      );
    }

    const data = await resp.json();
    await infoLog(`🛒 [MCP] Received shopping list data: ${JSON.stringify(data, null, 2)}`);

    return data;
  } catch (error) {
    errorLog(`🛒 [MCP] Error generating shopping list: ${error}`);
    throw error;
  }
}

import { z } from 'zod';

// Define the Zod schema for the request parameters
export const generateShoppingListArgs = z.object({
  plan: z.array(z.number().int().positive()).describe('Array of meal IDs to generate shopping list for')
});

export function registerGenerateShoppingList(server: McpServer) {
  server.tool(
    'generateShoppingList',
    'Generate a comprehensive shopping list based on the current meal plan. This analyzes all planned meals and creates a consolidated list of ingredients with quantities needed for the week.',
    {
      plan: generateShoppingListArgs.shape.plan
    },
    async ({ plan }) => {
      const json = await generateList(plan);
      return {
        content: [{ type: 'text', text: JSON.stringify(json, null, 2) }]
      };
    }
  );
}