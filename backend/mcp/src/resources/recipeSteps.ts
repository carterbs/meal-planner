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
  server.resource(
    'RecipeSteps',
    'meal://recipes/steps',
    {
      description: 'Get the detailed step-by-step cooking instructions for a specific recipe by providing its unique recipe ID. Returns an ordered list of cooking steps with clear instructions.',
      mimeType: 'application/json'
    },
    async () => {
      // For now, return empty steps - this would need recipe ID in a real implementation
      const data: RecipeSteps = [];
      return {
        contents: [{
          uri: 'meal://recipes/steps',
          text: JSON.stringify(data, null, 2),
          mimeType: 'application/json'
        }]
      };
    }
  );
}
