import { MealPlanningStep } from '../../../shared/types';

describe('initiate node (placeholder)', () => {
    it('moves to GENERATE_PLAN', async () => {
        // We will import the real function after extraction. For now, assert desired output shape.
        const initiate = async () => ({ currentStep: MealPlanningStep.GENERATE_PLAN });
        const result = await initiate();
        expect(result.currentStep).toBe(MealPlanningStep.GENERATE_PLAN);
    });
});


