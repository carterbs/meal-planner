import { MealPlanningStep } from '../../../shared/types';
import { finalizePlanNode } from './finalizePlan';
import { TestMockFactory } from '../../../tests/test-utils';

describe('finalizePlan node', () => {
    it('calls MCP finalize and advances', async () => {
        const plan = TestMockFactory.createMockWeeklyMealPlan();
        const state = TestMockFactory.createMockMealPlanningState({ mealPlan: plan, threadId: 't' });
        const deps = { callTool: jest.fn().mockResolvedValue({}) };
        const result = await finalizePlanNode(state as any, deps);
        expect(deps.callTool).toHaveBeenCalledWith({ name: 'finalizeMealPlan', arguments: { threadId: 't' } });
        expect(result.currentStep).toBe(MealPlanningStep.GENERATE_SHOPPING_LIST);
        expect(result.isFinalized).toBe(true);
    });
    it('throws if no thread id', async () => {
        const plan = TestMockFactory.createMockWeeklyMealPlan();
        const state = TestMockFactory.createMockMealPlanningState({ mealPlan: plan, threadId: undefined });
        await expect(finalizePlanNode(state as any, { callTool: async () => ({}) })).rejects.toThrow(
            'No thread ID available for finalization',
        );
    });
    it('throws if no plan', async () => {
        const state = TestMockFactory.createMockMealPlanningState({ mealPlan: undefined, threadId: 't' });
        await expect(finalizePlanNode(state as any, { callTool: async () => ({}) })).rejects.toThrow(
            'No meal plan to finalize',
        );
    });
});


