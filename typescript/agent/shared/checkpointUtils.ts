import { MealPlanningState, WorkflowType, MealPlanningStep } from './types';
import { MealPlanningCheckpointState } from '@mealplanner/generated';

/**
 * Convert internal MealPlanningState (snake_case keys) -> camelCase JSON for MealPlanningCheckpointState
 */
export function convertToCheckpointState(
  state: MealPlanningState,
): MealPlanningCheckpointState {
  return MealPlanningCheckpointState.fromJSON({
    threadId: state.threadId,
    participants: state.participants,
    createdAt: state.created_at instanceof Date ? state.created_at : new Date(state.created_at as any),
    updatedAt: state.updated_at instanceof Date ? state.updated_at : new Date(state.updated_at as any),
    currentStep: state.current_step,
    mealPlan: state.meal_plan || undefined,
    feedbackHistory: state.feedback_history || [],
    iterationCount: state.iteration_count ?? 0,
    shoppingList: state.shopping_list || undefined,
    isFinalized: state.is_finalized ?? false,
  });
}

/**
 * Convert MealPlanningCheckpointState -> internal MealPlanningState
 */
export function convertFromCheckpointState(
  proto: MealPlanningCheckpointState,
): MealPlanningState {
  const json = MealPlanningCheckpointState.toJSON(proto) as any;
  return {
    threadId: json.threadId,
    workflow_type: WorkflowType.MEAL_PLANNING,
    participants: json.participants ?? [],
    created_at: new Date(json.createdAt),
    updated_at: new Date(json.updatedAt),
    current_step: json.currentStep as MealPlanningStep,
    meal_plan: json.mealPlan ?? null,
    feedback_history: json.feedbackHistory ?? [],
    iteration_count: json.iterationCount ?? 0,
    shopping_list: json.shoppingList ?? null,
    is_finalized: json.isFinalized ?? false,
  } as MealPlanningState;
}
