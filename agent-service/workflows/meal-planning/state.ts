import { MealPlanningCheckpointState, WeeklyMealPlan } from '@mealplanner/generated';
import type { MealPlanningState } from '../../shared/types';

export function cloneAndUpdateState(
    currentState: MealPlanningState,
    updates: Partial<MealPlanningState>,
): MealPlanningState {
    const merged = new MealPlanningCheckpointState(currentState);
    Object.assign(merged as any, updates);
    return merged;
}

export function deserializeMealPlanFromCheckpoint(state: MealPlanningState): MealPlanningState {
    if (!state.mealPlan) return state;
    const deserialized = WeeklyMealPlan.fromJson(state.mealPlan.toJson());
    return new MealPlanningCheckpointState({ ...state, mealPlan: deserialized });
}


