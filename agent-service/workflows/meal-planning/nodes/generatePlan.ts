import { WeeklyMealPlan } from '@mealplanner/generated';
import { MealPlanningState, MealPlanningStep } from '../../../shared/types';

export interface GeneratePlanDeps {
    callTool: (args: { name: string; arguments: Record<string, unknown> }) => Promise<unknown>;
    extractJsonFromResponse: (response: string) => string;
}

export async function generatePlanNode(
    _state: MealPlanningState,
    deps: GeneratePlanDeps,
): Promise<Partial<MealPlanningState>> {
    const planResult = await deps.callTool({ name: 'generateMealPlan', arguments: {} });
    if ((planResult as any)?.isError) {
        const contentArr = Array.isArray((planResult as any).content)
            ? (planResult as any).content
            : [];
        const text = contentArr[0]?.type === 'text' ? contentArr[0].text : 'Unknown error';
        throw new Error(`MCP tool error: ${text}`);
    }
    const content = Array.isArray((planResult as any).content)
        ? (planResult as any).content[0]
        : undefined;
    const responseText = content?.type === 'text' ? content.text : '{}';
    const jsonText = deps.extractJsonFromResponse(responseText);
    const parsed = JSON.parse(jsonText);
    const mealPlan = WeeklyMealPlan.fromJson(parsed.plan ?? {});
    return { currentStep: MealPlanningStep.OPTIMIZE_PLAN, mealPlan };
}


