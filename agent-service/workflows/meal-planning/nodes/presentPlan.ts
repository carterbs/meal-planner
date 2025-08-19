import { MealPlanningState, MealPlanningStep } from '../../../shared/types';

export async function presentPlanNode(
    state: MealPlanningState,
): Promise<Partial<MealPlanningState>> {
    if (!state.mealPlan) {
        throw new Error('No meal plan to present');
    }
    return { currentStep: MealPlanningStep.AWAIT_FEEDBACK };
}


