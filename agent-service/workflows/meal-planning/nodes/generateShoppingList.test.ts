import { MealPlanningStep } from '../../../shared/types';
import { generateShoppingListNode } from './generateShoppingList';
import { TestMockFactory } from '../../../tests/test-utils';

describe('generateShoppingList node', () => {
    it('returns ShoppingList when items present', async () => {
        const plan = TestMockFactory.createMockWeeklyMealPlan([
            TestMockFactory.createMockMealPlanItem({
                dayIndex: 0,
                mealType: 'breakfast',
                mealSnapshot: TestMockFactory.createMockMeal({ id: 1 }),
            }),
            TestMockFactory.createMockMealPlanItem({
                dayIndex: 1,
                mealType: 'lunch',
                mealSnapshot: TestMockFactory.createMockMeal({ id: 2 }),
            }),
        ]);
        const state = TestMockFactory.createMockMealPlanningState({ mealPlan: plan });
        const deps = { callTool: jest.fn().mockResolvedValue({ isError: false, content: [{ type: 'text', text: '[{"ingredient":"Tomato"}]' }] }) };
        const result = await generateShoppingListNode(state as any, deps);
        expect(result.currentStep).toBe(MealPlanningStep.COMPLETE);
        expect(result.shoppingList).toBeDefined();
    });
    it('returns complete with undefined list on error', async () => {
        const plan = TestMockFactory.createMockWeeklyMealPlan();
        const state = TestMockFactory.createMockMealPlanningState({ mealPlan: plan });
        const deps = { callTool: jest.fn().mockRejectedValue(new Error('boom')) };
        const result = await generateShoppingListNode(state as any, deps);
        expect(result.currentStep).toBe(MealPlanningStep.COMPLETE);
        expect(result.shoppingList).toBeUndefined();
    });
});

