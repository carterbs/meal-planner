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
    server.resource('Recipes', 'meal://recipes/all', {
        description: 'Get a comprehensive list of all available recipes with their basic information including unique ID, name, effort level (LOW/MED/HIGH), and whether they contain red meat',
        mimeType: 'application/json'
    }, async () => {
        const data = await fetchRecipes();
        return {
            contents: [{
                    uri: 'meal://recipes/all',
                    text: JSON.stringify(data, null, 2),
                    mimeType: 'application/json'
                }]
        };
    });
}
