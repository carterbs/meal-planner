import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { createClient } from '@mealplanner/generated/gateway/client';
import { deleteMealsByMealIdIngredientsByIngredientId } from '@mealplanner/generated/gateway';
import type { GoMeal } from '@mealplanner/generated/gateway/types.gen';

export const removeMealIngredientArgs = z.object({
    mealId: z.number().int().positive().describe("ID of the meal containing the ingredient"),
    ingredientId: z.number().int().positive().describe("ID of the ingredient to remove")
});

export async function doRemoveMealIngredient(mealId: number, ingredientId: number): Promise<GoMeal> {
    const client = createClient({
        baseUrl: process.env.BACKEND_BASE_URL || 'http://127.0.0.1:8090',
    });

    try {
        const response = await deleteMealsByMealIdIngredientsByIngredientId({
            client,
            path: {
                mealId: mealId.toString(),
                ingredientId: ingredientId.toString()
            }
        });

        if (response.error) {
            throw new McpError(-32000, `Backend error: ${String(response.error)}`);
        }

        if (!response.data?.meal) {
            throw new McpError(-32000, 'No meal returned from remove ingredient request');
        }

        return response.data.meal;
    } catch (error) {
        if (error instanceof McpError) {
            throw error;
        }
        throw new McpError(-32000, `Backend error: ${String(error)}`);
    }
}

export function registerRemoveMealIngredient(server: McpServer) {
    server.tool('removeMealIngredient', 'Remove an ingredient from a meal by ingredient ID. Use this to clean up ingredient lists or remove unwanted items from recipes.', {
        mealId: removeMealIngredientArgs.shape.mealId,
        ingredientId: removeMealIngredientArgs.shape.ingredientId
    }, async ({ mealId, ingredientId }) => {
        const meal = await doRemoveMealIngredient(mealId, ingredientId);
        return {
            content: [{ type: 'text', text: JSON.stringify(meal, null, 2) }]
        };
    });
}