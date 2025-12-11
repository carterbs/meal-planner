/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { MealPlanningCheckpointState, MealPlan } from '@mealplanner/generated';
import type { MealPlanningState } from '../../shared/types';

export function cloneAndUpdateState(
    currentState: MealPlanningState,
    updates: Partial<MealPlanningState>,
): MealPlanningState {
    const merged = new MealPlanningCheckpointState(currentState);
    // Apply updates field-by-field to avoid unsafe any
    for (const [key, value] of Object.entries(updates)) {
        (merged as unknown as Record<string, unknown>)[key] = value as unknown;
    }
    return merged;
}

export function deserializeMealPlanFromCheckpoint(state: MealPlanningState): MealPlanningState {
    if (!state.mealPlan) return state;
    const serialized = state.mealPlan.toJson();
    const deserialized = MealPlan.fromJson(serialized);
    return new MealPlanningCheckpointState({ ...state, mealPlan: deserialized });
}
