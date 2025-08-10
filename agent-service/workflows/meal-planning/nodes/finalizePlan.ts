import { MealPlanningState, MealPlanningStep } from '../../../shared/types';

export interface FinalizePlanDeps {
    callTool: (args: { name: string; arguments: Record<string, unknown> }) => Promise<unknown>;
}

export async function finalizePlanNode(
    state: MealPlanningState,
    deps: FinalizePlanDeps,
): Promise<Partial<MealPlanningState>> {
    if (!state.threadId) {
        throw new Error('No thread ID available for finalization');
    }
    if (!state.mealPlan) {
        throw new Error('No meal plan to finalize');
    }
    try {
        await deps.callTool({ name: 'finalizeMealPlan', arguments: { threadId: state.threadId } });
    } catch (error) {
        throw new Error(`Critical failure: Could not save meal plan: ${String(error)}`);
    }
    return { currentStep: MealPlanningStep.GENERATE_SHOPPING_LIST, isFinalized: true };
}


