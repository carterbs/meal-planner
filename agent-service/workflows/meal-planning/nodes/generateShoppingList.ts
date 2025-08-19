import { ShoppingList, ShoppingListItem } from '@mealplanner/generated';
import { MealPlanningState, MealPlanningStep } from '../../../shared/types';

export interface GenerateShoppingListDeps {
    callTool: (args: { name: string; arguments: Record<string, unknown> }) => Promise<{ isError?: boolean; content?: Array<{ type?: string; text?: string }>|unknown }>;
}

export async function generateShoppingListNode(
    state: MealPlanningState,
    deps: GenerateShoppingListDeps,
): Promise<Partial<MealPlanningState>> {
    if (!state.mealPlan) {
        throw new Error('No meal plan for shopping list generation');
    }
    try {
        const mealIds = state.mealPlan.days
            .map((d) => d.meal?.id)
            .filter((id): id is number => id !== undefined)
            .filter((id, i, self) => self.indexOf(id) === i);
        const result = await deps.callTool({ name: 'generateShoppingList', arguments: { plan: mealIds } });
        if (result.isError) {
            const text = Array.isArray(result.content) && (result.content as Array<{ type?: string; text?: string }>)[0]?.type === 'text' ? (result.content as Array<{ type?: string; text?: string }>)[0].text ?? 'Unknown error' : 'Unknown error';
            throw new Error(`MCP tool error: ${text}`);
        }
        const responseText = Array.isArray(result.content) && (result.content as Array<{ type?: string; text?: string }>)[0]?.type === 'text' ? (result.content as Array<{ type?: string; text?: string }>)[0].text ?? '[]' : '[]';
        const parsed = JSON.parse(responseText) as Array<{ ingredient: string; quantity?: string; category?: string }>;
        if (!Array.isArray(parsed) || parsed.length === 0) {
            return { currentStep: MealPlanningStep.COMPLETE, shoppingList: undefined };
        }
        // Build ShoppingList
        const items: ShoppingListItem[] = parsed.map((it) =>
            ShoppingListItem.fromJson({ ingredient: it.ingredient, quantity: it.quantity ?? '', category: it.category ?? 'Other' }),
        );
        return { currentStep: MealPlanningStep.COMPLETE, shoppingList: new ShoppingList({ items }) };
    } catch {
        return { currentStep: MealPlanningStep.COMPLETE, shoppingList: undefined };
    }
}


