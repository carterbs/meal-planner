import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { API } from '../utils.js';
import { CreateMealRequest, CreateMealResponse, AddBulkStepsRequest, Meal, Ingredient, Step } from '@mealplanner/generated';
const ingredientSchema = z.object({
    name: z.string().describe("Name of the ingredient"),
    quantity: z.string().describe("Quantity needed (e.g., '2 cups', '1 lb', '3 cloves')")
});
const stepSchema = z.object({
    order: z.number().describe("Step number in the cooking sequence"),
    text: z.string().describe("Detailed instruction text for this cooking step")
});
export const createRecipeArgs = z.object({
    name: z.string().describe("The name of the new recipe"),
    redMeat: z.boolean().describe("Whether this recipe contains red meat (affects weekly red meat consumption tracking)"),
    effort: z.enum(['LOW', 'MED', 'HIGH']).describe("Cooking effort level required (LOW for simple, MED for moderate, HIGH for complex recipes)"),
    steps: z.array(stepSchema).describe("Array of cooking steps in order with step number and instruction text"),
    ingredients: z.array(ingredientSchema).optional().describe("Optional list of ingredients with names and quantities")
});
export async function createRecipe(data: z.infer<typeof createRecipeArgs>) {
    // Convert effort level to numeric value
    const effortMap = { 'LOW': 1, 'MED': 3, 'HIGH': 5 };
    const mealData = new Meal({
        id: 0, // Will be assigned by backend
        name: data.name,
        effort: effortMap[data.effort],
        hasRedMeat: data.redMeat,
        url: '',
        mealType: 'dinner', // Default meal type
        ingredients: [],
        steps: [],
        lastPlanned: undefined,
    });
    const requestData = new CreateMealRequest({
        meal: mealData,
    });
    const resp = await fetch(`${API}/api/meals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData.toJson({ emitDefaultValues: true }))
    });
    if (!resp.ok)
        throw new McpError(-32000, `BackendError: ${resp.statusText}`);
    const responseJson = await resp.json();
    const createResponse = CreateMealResponse.fromJson(responseJson);
    if (!createResponse.meal) {
        throw new McpError(-32000, 'No meal returned from create request');
    }
    const created = createResponse.meal;
    const id = created.id;
    const stepsRequestData = new AddBulkStepsRequest({
        mealId: id,
        instructions: data.steps.map(step => step.text),
    });
    const stepResp = await fetch(`${API}/api/meals/${id}/steps/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stepsRequestData.toJson({ emitDefaultValues: true }))
    });
    if (!stepResp.ok)
        throw new McpError(-32000, `BackendError: ${stepResp.statusText}`);
    if (data.ingredients) {
        for (const ing of data.ingredients) {
            const ir = await fetch(`${API}/api/meals/${id}/ingredients`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ing)
            });
            if (!ir.ok)
                throw new McpError(-32000, `BackendError: ${ir.statusText}`);
        }
    }
    return created;
}
export function registerCreateRecipe(server: McpServer) {
    server.tool('createRecipe', 'Create a new recipe with ingredients, cooking steps, and metadata. Specify effort level (LOW/MED/HIGH), red meat status for tracking, and detailed cooking instructions. The recipe will be added to the database and available for meal planning.', {
        name: createRecipeArgs.shape.name,
        redMeat: createRecipeArgs.shape.redMeat,
        effort: createRecipeArgs.shape.effort,
        steps: createRecipeArgs.shape.steps,
        ingredients: createRecipeArgs.shape.ingredients
    }, async (args) => {
        const json = await createRecipe(args);
        return {
            content: [{ type: 'text', text: JSON.stringify(json, null, 2) }]
        };
    });
}
