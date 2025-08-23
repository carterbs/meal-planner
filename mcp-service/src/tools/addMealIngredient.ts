import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { createClient } from '@mealplanner/generated/gateway/client';
import { postMealsByMealIdIngredients } from '@mealplanner/generated/gateway';
import type { GoMeal } from '@mealplanner/generated/gateway/types.gen';

const ingredientSchema = z.object({
    name: z.string().min(1).describe("Name of the ingredient"),
    quantity: z.number().describe("Quantity amount (numeric value)"), 
    unit: z.string().describe("Unit of measurement (e.g., 'cups', 'lbs', 'cloves')")
});

export const addMealIngredientArgs = z.object({
    mealId: z.number().int().positive().describe("ID of the meal to add ingredient to"),
    ingredient: ingredientSchema.describe("Ingredient to add with name, quantity, and unit")
});

export async function doAddMealIngredient(mealId: number, ingredient: z.infer<typeof ingredientSchema>): Promise<GoMeal> {
    const client = createClient({
        baseUrl: process.env.BACKEND_BASE_URL || 'http://127.0.0.1:8090',
    });

    try {
        const response = await postMealsByMealIdIngredients({
            client,
            path: {
                mealId: mealId.toString()
            },
            body: {
                mealId: mealId,
                ingredient: {
                    id: 0, // Will be assigned by backend
                    mealId: mealId,
                    name: ingredient.name,
                    quantity: ingredient.quantity,
                    unit: ingredient.unit
                }
            }
        });

        if (response.error) {
            throw new McpError(-32000, `Backend error: ${String(response.error)}`);
        }

        if (!response.data?.meal) {
            throw new McpError(-32000, 'No meal returned from add ingredient request');
        }

        return response.data.meal;
    } catch (error) {
        if (error instanceof McpError) {
            throw error;
        }
        throw new McpError(-32000, `Backend error: ${String(error)}`);
    }
}

export function registerAddMealIngredient(server: McpServer) {
    server.tool('addMealIngredient', 'Add a new ingredient to an existing meal with specified quantity and unit. Essential for building complete recipe ingredient lists.', {
        mealId: addMealIngredientArgs.shape.mealId,
        ingredient: addMealIngredientArgs.shape.ingredient
    }, async ({ mealId, ingredient }) => {
        const meal = await doAddMealIngredient(mealId, ingredient);
        return {
            content: [{ type: 'text', text: JSON.stringify(meal, null, 2) }]
        };
    });
}