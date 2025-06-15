import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { API } from '../utils.js';

export const deleteRecipeArgs = z.object({ 
  id: z.number().int().positive().describe("The unique ID of the recipe to permanently delete from the database")
});

export async function deleteRecipe(id: number) {
  const resp = await fetch(`${API}/api/meals/${id}`, { method: 'DELETE' });
  if (!resp.ok) throw new McpError(-32000, `BackendError: ${resp.statusText}`);
  return resp.json();
}

export function registerDeleteRecipe(server: McpServer) {
  server.tool(
    'deleteRecipe',
    'Permanently delete a recipe from the database by its unique ID. This action cannot be undone and will remove the recipe from all future meal planning. Use with caution.',
    {
      id: deleteRecipeArgs.shape.id
    },
    async ({ id }) => {
      const json = await deleteRecipe(id);
      return {
        content: [{ type: 'text', text: JSON.stringify(json, null, 2) }]
      };
    }
  );
}
