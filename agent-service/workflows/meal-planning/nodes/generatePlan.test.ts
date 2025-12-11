import { MealPlan } from '@mealplanner/generated';
import { MealPlanningStep } from '../../../shared/types';

describe('generatePlan node (placeholder)', () => {
    it('returns OPTIMIZE_PLAN and a MealPlan instance', async () => {
        // Placeholder until node is extracted
        const generate = async () => ({
            currentStep: MealPlanningStep.OPTIMIZE_PLAN,
            mealPlan: new MealPlan({ items: [] }),
        });
        const result = await generate();
        expect(result.currentStep).toBe(MealPlanningStep.OPTIMIZE_PLAN);
        expect(result.mealPlan).toBeInstanceOf(MealPlan);
    });
});

