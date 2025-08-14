import { getAnalyzeFeedbackPrompt as defaultPrompt } from '../../../meal-planning-prompts';

export interface AnalyzeFeedbackDeps {
    nanoLlm: { invoke: (messages: Array<{ role: string; content: string }>) => Promise<{ content: string | unknown }> };
    getAnalyzeFeedbackPrompt?: (content: string) => string;
    extractJsonFromResponse: (text: string) => string;
}

export async function analyzeFeedbackNode(
    feedbackEntries: Array<{ content: string }>,
    deps: AnalyzeFeedbackDeps,
): Promise<{ satisfied: boolean; reasoning: string }> {
    const latestFeedback = feedbackEntries[feedbackEntries.length - 1];
    const prompt = (deps.getAnalyzeFeedbackPrompt ?? defaultPrompt)(latestFeedback.content);
    const result = await deps.nanoLlm.invoke([{ role: 'user', content: prompt }]);
    const raw = typeof result.content === 'string' ? result.content : JSON.stringify(result.content as Record<string, unknown>);
    return JSON.parse(deps.extractJsonFromResponse(raw)) as { satisfied: boolean; reasoning: string };
}


