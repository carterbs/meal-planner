import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { createClient } from '@mealplanner/generated/gateway/client';
import { putMealsByMealIdIngredientsByIngredientId } from '@mealplanner/generated/gateway';
import type { GoMeal } from '@mealplanner/generated/gateway/types.gen';

const ingredientUpdateSchema = z.object({
    name: z.string().optional().describe("Name of the ingredient"),
    quantity: z.number().optional().describe("Quantity amount (numeric value)"), 
    unit: z.string().optional().describe("Unit of measurement (e.g., 'cups', 'lbs', 'cloves')")
});

export const updateMealIngredientArgs = z.object({
    mealId: z.number().int().positive().describe("ID of the meal containing the ingredient"),
    ingredientId: z.number().int().positive().describe("ID of the ingredient to update"),
    ingredient: ingredientUpdateSchema.describe("Ingredient updates - only provide fields to change")
});

export async function doUpdateMealIngredient(
    mealId: number, 
    ingredientId: number, 
    ingredient: z.infer<typeof ingredientUpdateSchema>
): Promise<GoMeal> {
    const client = createClient({
        baseUrl: process.env.BACKEND_BASE_URL || 'http://127.0.0.1:8090',
    });

    try {
        const response = await putMealsByMealIdIngredientsByIngredientId({
            client,
            path: {
                mealId: mealId.toString(),
                ingredientId: ingredientId.toString()
            },
            body: {
                mealId: mealId,
                ingredientId: ingredientId,
                ingredient: {
                    id: ingredientId,
                    mealId: mealId,
                    name: ingredient.name || "",
                    quantity: ingredient.quantity || 0,
                    unit: ingredient.unit || ""
                }
            }
        });

        if (response.error) {
            throw new McpError(-32000, `Backend error: ${String(response.error)}`);
        }

        if (!response.data?.meal) {
            throw new McpError(-32000, 'No meal returned from update ingredient request');
        }

        return response.data.meal;
    } catch (error) {
        if (error instanceof McpError) {
            throw error;
        }
        throw new McpError(-32000, `Backend error: ${String(error)}`);
    }
}

export function registerUpdateMealIngredient(server: McpServer) {
    server.tool('updateMealIngredient', 'Update an existing ingredient in a meal with new quantity, unit, or name. Allows precise modification of recipe ingredients.', {
        mealId: updateMealIngredientArgs.shape.mealId,
        ingredientId: updateMealIngredientArgs.shape.ingredientId,
        ingredient: updateMealIngredientArgs.shape.ingredient
    }, async ({ mealId, ingredientId, ingredient }) => {
        const meal = await doUpdateMealIngredient(mealId, ingredientId, ingredient);
        return {
            content: [{ type: 'text', text: JSON.stringify(meal, null, 2) }]
        };
    });
}