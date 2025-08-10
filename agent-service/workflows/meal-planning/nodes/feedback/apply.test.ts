import { applyFeedbackNode } from './apply';
import { TestMockFactory } from '../../../../tests/test-utils';

describe('feedback/apply node', () => {
    it('applies feedback and stores agent message', async () => {
        const plan = TestMockFactory.createMockWeeklyMealPlan();
        const state = TestMockFactory.createMockMealPlanningState({ mealPlan: plan, threadId: 't' });
        const deps = {
            getMessages: jest.fn().mockResolvedValue(['please change']),
            applyFeedbackWithLLM: jest.fn().mockResolvedValue({ mealPlan: plan, userMessage: 'done' }),
            addMessage: jest.fn().mockResolvedValue(undefined),
        } as any;
        const result = await applyFeedbackNode(state as any, deps);
        expect(deps.getMessages).toHaveBeenCalledWith('t');
        expect(deps.applyFeedbackWithLLM).toHaveBeenCalled();
        expect(deps.addMessage).toHaveBeenCalledWith('t', 'agent', 'done');
        expect(result.mealPlan).toBeDefined();
    });
    it('throws if no plan', async () => {
        const state = TestMockFactory.createMockMealPlanningState({ mealPlan: undefined });
        await expect(
            applyFeedbackNode(state as any, {
                getMessages: async () => [],
                applyFeedbackWithLLM: async (p: any) => ({ mealPlan: p, userMessage: '' }),
                addMessage: async () => undefined,
            } as any),
        ).rejects.toThrow('No meal plan to apply feedback to');
    });
});


