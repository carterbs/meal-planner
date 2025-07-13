import { MealPlanningState, WorkflowType, MealPlanningStep } from './types';
import { MealPlanningCheckpointState, ShoppingList } from '@mealplanner/generated';
import { Timestamp } from '@bufbuild/protobuf';

/**
 * Convert internal MealPlanningState (snake_case keys) -> camelCase JSON for MealPlanningCheckpointState
 */
export function convertToCheckpointState(
  state: MealPlanningState,
): MealPlanningCheckpointState {
  return new MealPlanningCheckpointState({
    threadId: state.threadId,
    participants: state.participants,
    createdAt: state.created_at instanceof Date ? Timestamp.fromDate(state.created_at) : Timestamp.fromDate(new Date(state.created_at as any)),
    updatedAt: state.updated_at instanceof Date ? Timestamp.fromDate(state.updated_at) : Timestamp.fromDate(new Date(state.updated_at as any)),
    currentStep: state.current_step,
    mealPlan: state.meal_plan || undefined,
    feedbackHistory: (state.feedback_history || []).map(feedback => ({
      ...feedback,
      timestamp: feedback.timestamp instanceof Date ? Timestamp.fromDate(feedback.timestamp) : Timestamp.fromDate(new Date(feedback.timestamp as any))
    })),
    iterationCount: state.iteration_count ?? 0,
    shoppingList: state.shopping_list ? new ShoppingList({ items: state.shopping_list }) : undefined,
    isFinalized: state.is_finalized ?? false,
  });
}

/**
 * Convert MealPlanningCheckpointState -> internal MealPlanningState
 */
export function convertFromCheckpointState(
  proto: MealPlanningCheckpointState,
): MealPlanningState {
  const json = proto.toJson() as any;
  return {
    threadId: json.threadId,
    workflow_type: WorkflowType.MEAL_PLANNING,
    participants: json.participants ?? [],
    created_at: proto.createdAt ? proto.createdAt.toDate() : new Date(),
    updated_at: proto.updatedAt ? proto.updatedAt.toDate() : new Date(),
    current_step: json.currentStep as MealPlanningStep,
    meal_plan: json.mealPlan ?? null,
    feedback_history: json.feedbackHistory ?? [],
    iteration_count: json.iterationCount ?? 0,
    shopping_list: proto.shoppingList?.items ?? null,
    is_finalized: json.isFinalized ?? false,
  } as MealPlanningState;
}
