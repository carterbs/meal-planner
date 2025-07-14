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
    createdAt: state.created_at instanceof Date ? Timestamp.fromDate(state.created_at) : (state.created_at ? Timestamp.fromDate(new Date(state.created_at as any)) : Timestamp.fromDate(new Date())),
    updatedAt: state.updated_at instanceof Date ? Timestamp.fromDate(state.updated_at) : (state.updated_at ? Timestamp.fromDate(new Date(state.updated_at as any)) : Timestamp.fromDate(new Date())),
    currentStep: state.current_step,
    mealPlan: state.meal_plan || undefined,
    feedbackHistory: (state.feedback_history || []).map(feedback => ({
      ...feedback,
      timestamp: feedback.timestamp instanceof Date ? Timestamp.fromDate(feedback.timestamp) : (feedback.timestamp ? Timestamp.fromDate(new Date(feedback.timestamp as any)) : Timestamp.fromDate(new Date()))
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
    feedback_history: (json.feedbackHistory ?? []).map((feedback: any) => ({
      ...feedback,
      timestamp: feedback.timestamp ? (typeof feedback.timestamp === 'string' ? new Date(feedback.timestamp) : feedback.timestamp) : new Date()
    })),
    iteration_count: json.iterationCount ?? 0,
    shopping_list: proto.shoppingList?.items ?? null,
    is_finalized: json.isFinalized ?? false,
  } as MealPlanningState;
}
