import { MealPlanningCheckpointState, WeeklyMealPlan } from '@mealplanner/generated';
import type { MealPlanningState } from '../../shared/types';

export function cloneAndUpdateState(
    currentState: MealPlanningState,
    updates: Partial<MealPlanningState>,
): MealPlanningState {
    const merged = new MealPlanningCheckpointState(currentState);
    // Apply updates field-by-field to avoid unsafe any
    for (const [key, value] of Object.entries(updates)) {
        // @ts-expect-error: indexing into generated message by key
        (merged as unknown as Record<string, unknown>)[key] = value as unknown;
    }
    return merged;
}

export function deserializeMealPlanFromCheckpoint(state: MealPlanningState): MealPlanningState {
    if (!state.mealPlan) return state;
    const deserialized = WeeklyMealPlan.fromJson(state.mealPlan.toJson());
    return new MealPlanningCheckpointState({ ...state, mealPlan: deserialized });
}


