import { WeeklyMealPlan as GeneratedWeeklyMealPlan } from '@mealplanner/generated';
import { MealPlanningState, MealPlanningStep } from '../../../shared/types';

export interface OptimizePlanDeps {
    validatePlan: (plan: GeneratedWeeklyMealPlan) => string[];
    optimizePlanWithLLM: (
        plan: GeneratedWeeklyMealPlan,
        issues: string[],
    ) => Promise<GeneratedWeeklyMealPlan>;
}

export async function optimizePlanNode(
    state: MealPlanningState,
    deps: OptimizePlanDeps,
): Promise<Partial<MealPlanningState>> {
    if (!state.mealPlan) {
        throw new Error('No meal plan to optimize');
    }
    const issues = deps.validatePlan(state.mealPlan);
    const optimizedPlan =
        issues.length > 0
            ? await deps.optimizePlanWithLLM(state.mealPlan, issues)
            : state.mealPlan;
    return {
        currentStep: MealPlanningStep.PRESENT_PLAN,
        mealPlan: optimizedPlan,
        iterationCount: state.iterationCount + 1,
    } as Partial<MealPlanningState>;
}


