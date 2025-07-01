import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { API } from '../utils.js';

export const getMealsArgs = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner']).optional().describe("Filter by meal type")
});

export interface Meal {
  id: number;
  mealName: string;
  relativeEffort: number;
  lastPlanned: string;
  redMeat: boolean;
  url: string;
  mealType: string;
  ingredients: any[];
  steps: any[];
}

export async function doGetMeals(mealType?: string): Promise<Meal[]> {
  const url = mealType ? `${API}/api/meals?type=${mealType}` : `${API}/api/meals`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new McpError(-32000, `BackendError: ${resp.statusText}`);
  }
  return resp.json();
}

export function registerGetMeals(server: McpServer) {
  server.tool(
    'getMeals',
    'Fetch all available meals with detailed metadata including effort levels, meal types, red meat status, and last planned dates. Essential for making informed meal replacement decisions.',
    {
      mealType: getMealsArgs.shape.mealType
    },
    async ({ mealType }) => {
      const meals = await doGetMeals(mealType);
      return {
        content: [{ type: 'text', text: JSON.stringify(meals, null, 2) }]
      };
    }
  );
}