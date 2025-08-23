import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { createClient } from '@mealplanner/generated/gateway/client';
import { getMeals } from '@mealplanner/generated/gateway';
import type { GoIngredient } from '@mealplanner/generated/gateway/types.gen';

export const getMealIngredientsArgs = z.object({
    mealId: z.number().int().positive().describe("ID of the meal to get ingredients for")
});

export async function doGetMealIngredients(mealId: number): Promise<GoIngredient[]> {
    const client = createClient({
        baseUrl: process.env.BACKEND_BASE_URL || 'http://127.0.0.1:8090',
    });

    try {
        // Get all meals and find the one with matching ID
        const response = await getMeals({ client });
        
        if (response.error) {
            throw new McpError(-32000, `Backend error: ${String(response.error)}`);
        }
        
        if (!response.data?.meals) {
            throw new McpError(-32000, 'No meals returned from backend');
        }
        
        // Find the meal with the matching ID
        const meal = response.data.meals.find(m => m.id === mealId);
        if (!meal) {
            throw new McpError(-32000, `Meal with ID ${mealId} not found`);
        }
        
        return meal.ingredients || [];
    } catch (error) {
        if (error instanceof McpError) {
            throw error;
        }
        throw new McpError(-32000, `Backend error: ${String(error)}`);
    }
}

export function registerGetMealIngredients(server: McpServer) {
    server.tool('getMealIngredients', 'Fetch all ingredients for a specific meal, including quantities, units, and names. Essential for understanding meal composition and managing ingredient lists.', {
        mealId: getMealIngredientsArgs.shape.mealId
    }, async ({ mealId }) => {
        const ingredients = await doGetMealIngredients(mealId);
        return {
            content: [{ type: 'text', text: JSON.stringify(ingredients, null, 2) }]
        };
    });
}