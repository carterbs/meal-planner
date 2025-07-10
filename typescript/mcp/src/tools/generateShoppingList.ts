import { debugLog, infoLog, warnLog, errorLog } from "../logging";
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { API } from '../utils.js';
import type { ShoppingListItem } from '@mealplanner/generated';

export type ShoppingList = ShoppingListItem[];

interface ShoppingListRequest {
  plan: number[]; // Array of meal IDs
}

export async function generateList(plan: number[]): Promise<ShoppingList> {
  try {
    infoLog(`🛒 [MCP] Generating shopping list for plan: ${plan}`);
    const resp = await fetch(`${API}/api/shoppinglist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ plan } as ShoppingListRequest)
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      throw new McpError(
        -32000,
        `BackendError: ${resp.status} ${resp.statusText} - ${errorData.message || 'Unknown error'}`
      );
    }

    const data = await resp.json();
    infoLog(`🛒 [MCP] Received shopping list data: ${JSON.stringify(data, null, 2)}`);

    // Ensure the response is an array of items with required fields
    if (!Array.isArray(data)) {
      throw new McpError(-32603, 'Invalid response format: expected an array of items');
    }

    // Map legacy/raw item fields to the unified ShoppingListItem type
    const mappedItems = data.map((item) => {
      // If already in correct format, return as is
      if (typeof item.ingredient === 'string' && typeof item.quantity === 'string') {
        return item;
      }
      // Map legacy fields (ID, Name, Quantity, Unit, etc.)
      if (typeof item.Name === 'string' && (typeof item.Quantity === 'string' || typeof item.Quantity === 'number')) {
        return {
          ingredient: item.Name,
          quantity: (item.Quantity ? String(item.Quantity) : '') + (item.Unit ? ' ' + item.Unit : ''),
          category: item.Category || undefined
        };
      }
      // If it doesn't fit either, skip (will be filtered out)
      return null;
    }).filter(Boolean);

    // Validate each item has required fields
    const validItems = mappedItems.filter((item) =>
    item && typeof item.ingredient === 'string' && typeof item.quantity === 'string'
    );

    if (validItems.length !== mappedItems.length) {
      warnLog('🛒 [MCP] Some items in the shopping list are missing required fields or could not be mapped');
    }

    return validItems;
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