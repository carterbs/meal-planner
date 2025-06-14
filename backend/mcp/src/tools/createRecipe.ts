import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { API } from '../utils.js';

const ingredientSchema = z.object({ name: z.string(), quantity: z.string() });
const stepSchema = z.object({ order: z.number(), text: z.string() });

export const createRecipeArgs = z.object({
  name: z.string(),
  redMeat: z.boolean(),
  effort: z.enum(['LOW', 'MED', 'HIGH']),
  steps: z.array(stepSchema),
  ingredients: z.array(ingredientSchema).optional(),
});

export async function createRecipe(data: z.infer<typeof createRecipeArgs>) {
  const resp = await fetch(`${API}/api/meals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: data.name, redMeat: data.redMeat, effort: data.effort })
  });
  if (!resp.ok) throw new McpError(-32000, `BackendError: ${resp.statusText}`);
  const created = await resp.json();
  const id = created.id;
  const stepResp = await fetch(`${API}/api/meals/${id}/steps/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ steps: data.steps })
  });
  if (!stepResp.ok) throw new McpError(-32000, `BackendError: ${stepResp.statusText}`);
  if (data.ingredients) {
    for (const ing of data.ingredients) {
      const ir = await fetch(`${API}/api/meals/${id}/ingredients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ing)
      });
      if (!ir.ok) throw new McpError(-32000, `BackendError: ${ir.statusText}`);
    }
  }
  return created;
}

export function registerCreateRecipe(server: McpServer) {
  server.tool('createRecipe', createRecipeArgs, async (args) => {
    const json = await createRecipe(args);
    return { content: [{ type: 'json', json }] };
  });
}
