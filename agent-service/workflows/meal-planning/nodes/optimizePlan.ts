/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { MealPlan as GeneratedMealPlan } from '@mealplanner/generated';
import { MealPlanningState, MealPlanningStep } from '../../../shared/types';

export interface OptimizePlanDeps {
    validatePlan: (plan: GeneratedMealPlan) => string[];
    optimizePlanWithLLM: (
        plan: GeneratedMealPlan,
        issues: string[],
    ) => Promise<GeneratedMealPlan>;
}

export async function optimizePlanNode(
    state: MealPlanningState,
    deps: OptimizePlanDeps,
): Promise<Partial<MealPlanningState>> {
    if (!state.mealPlan) {
        throw new Error('No meal plan to optimize');
    }
    const plan = state.mealPlan;
    const issues = deps.validatePlan(plan);
    const optimizedPlan =
        issues.length > 0
            ? await deps.optimizePlanWithLLM(plan, issues)
            : plan;
    return {
        currentStep: MealPlanningStep.PRESENT_PLAN,
        mealPlan: optimizedPlan,
        iterationCount: state.iterationCount + 1,
    } as Partial<MealPlanningState>;
}
