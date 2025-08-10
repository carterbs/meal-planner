import { MealPlanningStep } from '../../../shared/types';
import { presentPlanNode } from './presentPlan';
import { TestMockFactory } from '../../../tests/test-utils';

describe('presentPlan node', () => {
    it('returns AWAIT_FEEDBACK when mealPlan exists', async () => {
        const mockPlan = TestMockFactory.createMockWeeklyMealPlan();
        const state = TestMockFactory.createMockMealPlanningState({ mealPlan: mockPlan });
        const result = await presentPlanNode(state as any);
        expect(result.currentStep).toBe(MealPlanningStep.AWAIT_FEEDBACK);
    });
    it('throws when mealPlan is missing', async () => {
        const state = TestMockFactory.createMockMealPlanningState({ mealPlan: undefined });
        await expect(presentPlanNode(state as any)).rejects.toThrow('No meal plan to present');
    });
});


