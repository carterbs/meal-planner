import { MealPlanningState, MealPlanningStep } from '../../../shared/types';

export async function initiateNode(
    state: MealPlanningState,
): Promise<Partial<MealPlanningState>> {
    // Keep behavior identical to existing method
    void state; // placeholder to keep signature; logic is trivial
    return { currentStep: MealPlanningStep.GENERATE_PLAN };
}


