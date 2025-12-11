/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import * as grpc from '@grpc/grpc-js';
import { LangGraphAgent } from '../../langgraph-agent';
import { debugLog } from '../../logging';
import { WorkflowType, MealPlanningState } from '../../shared/types';
import { PlanStartRequest, PlanStartResponse } from '@mealplanner/generated/agent_pb';

let agentInstance: LangGraphAgent | null = null;
async function initializeAgent(): Promise<LangGraphAgent> {
    if (!agentInstance) {
        agentInstance = new LangGraphAgent({
            defaultParticipants: ['brad', 'shannon'],
        });
        await agentInstance.initialize();
    }
    return agentInstance;
}

export function planStart(
    call: grpc.ServerUnaryCall<PlanStartRequest, PlanStartResponse>,
    callback: grpc.sendUnaryData<PlanStartResponse>,
): void {
    (async () => {
        try {
            const request = call.request;
            const participants = Array.isArray(request.participants) ? request.participants : [];
            if (participants.length === 0) {
                return callback(new Error('At least one participant is required.'));
            }
            const agent = await initializeAgent();
            await debugLog(
                `🔄 Starting meal planning session for participants: ${participants.join(', ')}`,
            );
            const threadId = await agent.startWorkflow(
                WorkflowType.MEAL_PLANNING,
                participants,
            );
            await debugLog(`🔄 Got a threadId: ${String(threadId)}`);
            let initialState: MealPlanningState;
            try {
                initialState = await agent.getWorkflowState(threadId);
            } catch (e) {
                const errMsg = e instanceof Error ? e.message : String(e);
                await debugLog(`Failed to fetch initial workflow state: ${errMsg}`);
                return callback(e as Error);
            }
            // Normalize missing dayIndex values to 0 to satisfy client expectations/tests
            const mealPlanItems = initialState.mealPlan?.items ?? [];
            mealPlanItems.forEach((entry) => {
                if (typeof entry.dayIndex !== 'number') {
                    entry.dayIndex = 0;
                }
            });
            const maybeToJson = (initialState as Partial<MealPlanningState> & { toJsonString?: (opts?: unknown) => string }).toJsonString;
            const stateString = typeof maybeToJson === 'function'
                ? maybeToJson({ emitDefaultValues: true })
                : JSON.stringify(initialState);
            const response = new PlanStartResponse({
                success: true,
                message: 'Meal planning session started',
                threadId,
                currentStep: initialState.currentStep,
                initialState: new TextEncoder().encode(stateString),
            });
            callback(null, response);
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            await debugLog(`Error starting meal planning session: ${errMsg}`);
            callback(new Error(`Error starting meal planning session: ${errMsg}`));
        }
    })();
}
