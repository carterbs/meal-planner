import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { API } from '../utils.js';

export interface RecipeSummary {
  id: number;
  name: string;
  redMeat: boolean;
  effort: 'LOW' | 'MED' | 'HIGH';
}

export async function fetchRecipes(): Promise<RecipeSummary[]> {
  const response = await fetch(`${API}/api/meals`);
  if (!response.ok) {
    throw new McpError(-32000, `BackendError: ${response.statusText}`);
  }
  return response.json();
}

export function registerRecipes(server: McpServer) {
  server.resource<RecipeSummary[]>('Recipes', fetchRecipes);
}
