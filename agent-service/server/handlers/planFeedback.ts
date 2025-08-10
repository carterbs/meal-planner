import * as grpc from '@grpc/grpc-js';
import { LangGraphAgent } from '../../langgraph-agent';
import { debugLog } from '../../logging';
import { PlanFeedbackRequest, PlanFeedbackResponse } from '@mealplanner/generated/agent_pb';

let agentInstance: LangGraphAgent | null = null;
async function initializeAgent(): Promise<LangGraphAgent> {
    if (!agentInstance) {
        agentInstance = new LangGraphAgent({
            defaultParticipants: ['brad', 'shannon'],
        } as any);
        await agentInstance.initialize();
    }
    return agentInstance;
}

export function planFeedback(
    call: grpc.ServerUnaryCall<PlanFeedbackRequest, PlanFeedbackResponse>,
    callback: grpc.sendUnaryData<PlanFeedbackResponse>,
): void {
    (async () => {
        try {
            const request = call.request;
            const threadId = request.threadId;
            const from = request.from;
            const message = request.message;
            if (!threadId) return callback(new Error('threadId required'));
            if (!from) return callback(new Error('from required'));
            if (!message) return callback(new Error('message required'));
            const agent = await initializeAgent();
            // Resume workflow (message persistence is done in main handlers in existing system)
            const result = await agent.resumeWorkflow(threadId, {});
            const resp = new PlanFeedbackResponse({
                success: result.success,
                message: result.message || '',
            });
            callback(null, resp);
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            await debugLog(`Error in planFeedback: ${errMsg}`);
            callback(new Error(`Error in planFeedback: ${errMsg}`));
        }
    })();
}


