import { WeeklyMealPlan as GeneratedWeeklyMealPlan } from '@mealplanner/generated';
import { MealPlanningState } from '../../../../shared/types';

export interface ApplyFeedbackDeps {
    getMessages: (threadId: string) => Promise<string[]>;
    applyFeedbackWithLLM: (
        plan: GeneratedWeeklyMealPlan,
        feedback: string[],
    ) => Promise<{ mealPlan: GeneratedWeeklyMealPlan; userMessage: string }>;
    addMessage: (threadId: string, sender: string, message: string) => Promise<void>;
}

export async function applyFeedbackNode(
    state: MealPlanningState & { feedback_to_apply?: any[] },
    deps: ApplyFeedbackDeps,
): Promise<Partial<MealPlanningState>> {
    if (!state.mealPlan) {
        throw new Error('No meal plan to apply feedback to');
    }
    const feedbackMessages = state.feedback_to_apply
        ? state.feedback_to_apply.map((f) => f.content)
        : await deps.getMessages(state.threadId);
    const result = await deps.applyFeedbackWithLLM(state.mealPlan, feedbackMessages);
    if (result.userMessage) {
        await deps.addMessage(state.threadId, 'agent', result.userMessage);
    }
    return { mealPlan: result.mealPlan };
}


