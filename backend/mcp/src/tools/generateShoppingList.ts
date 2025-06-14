import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { API } from '../utils.js';

export interface Item { name: string; quantity: string; }
export type ShoppingList = Item[];

export async function generateList(): Promise<ShoppingList> {
  const resp = await fetch(`${API}/api/shoppinglist`, { method: 'POST' });
  if (!resp.ok) {
    throw new McpError(-32000, `BackendError: ${resp.statusText}`);
  }
  return resp.json();
}

export function registerGenerateShoppingList(server: McpServer) {
  server.tool('generateShoppingList', null, async () => {
    const json = await generateList();
    return { content: [{ type: 'json', json }] };
  });
}
