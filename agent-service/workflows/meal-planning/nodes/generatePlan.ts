import { WeeklyMealPlan } from '@mealplanner/generated';
import { MealPlanningState, MealPlanningStep } from '../../../shared/types';

export interface GeneratePlanDeps {
    callTool: (args: { name: string; arguments: Record<string, unknown> }) => Promise<{ isError?: boolean; content?: Array<{ type?: string; text?: string }>|unknown }>;
    extractJsonFromResponse: (response: string) => string;
}

export async function generatePlanNode(
    _state: MealPlanningState,
    deps: GeneratePlanDeps,
): Promise<Partial<MealPlanningState>> {
    const planResult = await deps.callTool({ name: 'generateMealPlan', arguments: {} });
    if (planResult && planResult.isError) {
        const contentArr = Array.isArray(planResult.content)
            ? (planResult.content as Array<{ type?: string; text?: string }>)
            : [];
        const text = contentArr[0]?.type === 'text' ? (contentArr[0].text ?? 'Unknown error') : 'Unknown error';
        throw new Error(`MCP tool error: ${text}`);
    }
    const content = Array.isArray(planResult.content)
        ? (planResult.content as Array<{ type?: string; text?: string }>)[0]
        : undefined;
    const responseText = content?.type === 'text' ? content.text : '{}';
    const jsonText = deps.extractJsonFromResponse(responseText);
    const parsed: unknown = JSON.parse(jsonText);
    const planObj = (parsed && typeof parsed === 'object' && (parsed as { plan?: unknown }).plan) || {};
    const mealPlan = WeeklyMealPlan.fromJson(planObj as Record<string, unknown>);
    return { currentStep: MealPlanningStep.OPTIMIZE_PLAN, mealPlan };
}


