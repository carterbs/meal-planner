import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { API } from '../utils.js';

export interface Step {
  order: number;
  text: string;
}

export type RecipeSteps = Step[];

export async function fetchRecipeSteps(id: number): Promise<RecipeSteps> {
  const response = await fetch(`${API}/api/meals/${id}/steps`);
  if (!response.ok) {
    throw new McpError(-32000, `BackendError: ${response.statusText}`);
  }
  return response.json();
}

export function registerRecipeSteps(server: McpServer) {
  server.resource<RecipeSteps>('RecipeSteps', async (_, { id }: { id: number }) => fetchRecipeSteps(id));
}
