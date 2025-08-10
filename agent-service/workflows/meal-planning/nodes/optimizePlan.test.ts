import { MealPlanningStep } from '../../../shared/types';
import { optimizePlanNode } from './optimizePlan';
import { TestMockFactory } from '../../../tests/test-utils';

describe('optimizePlan node', () => {
    it('returns PRESENT_PLAN and increments iteration count when no issues', async () => {
        const plan = TestMockFactory.createMockWeeklyMealPlan();
        const state = TestMockFactory.createMockMealPlanningState({ mealPlan: plan, iterationCount: 1 });
        const result = await optimizePlanNode(state as any, {
            validatePlan: () => [],
            optimizePlanWithLLM: async (p, _i) => p,
        });
        expect(result.currentStep).toBe(MealPlanningStep.PRESENT_PLAN);
        expect(result.iterationCount).toBe(2);
    });
    it('calls LLM when issues exist', async () => {
        const plan = TestMockFactory.createMockWeeklyMealPlan();
        const state = TestMockFactory.createMockMealPlanningState({ mealPlan: plan, iterationCount: 0 });
        const mockLLM = jest.fn().mockResolvedValue(plan);
        const result = await optimizePlanNode(state as any, {
            validatePlan: () => ['issue'],
            optimizePlanWithLLM: mockLLM,
        });
        expect(mockLLM).toHaveBeenCalled();
        expect(result.currentStep).toBe(MealPlanningStep.PRESENT_PLAN);
    });
    it('throws if no plan to optimize', async () => {
        const state = TestMockFactory.createMockMealPlanningState({ mealPlan: undefined });
        await expect(
            optimizePlanNode(state as any, {
                validatePlan: () => [],
                optimizePlanWithLLM: async (p, _i) => p,
            }),
        ).rejects.toThrow('No meal plan to optimize');
    });
});


