import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { API } from '../utils.js';

export const deleteRecipeArgs = z.object({ id: z.number().int().positive() });

export async function deleteRecipe(id: number) {
  const resp = await fetch(`${API}/api/meals/${id}`, { method: 'DELETE' });
  if (!resp.ok) throw new McpError(-32000, `BackendError: ${resp.statusText}`);
  return resp.json();
}

export function registerDeleteRecipe(server: McpServer) {
  server.tool('deleteRecipe', deleteRecipeArgs, async ({ id }) => {
    const json = await deleteRecipe(id);
    return { content: [{ type: 'json', json }] };
  });
}
