import * as grpc from '@grpc/grpc-js';
import { LangGraphAgent } from '../../langgraph-agent';
import { debugLog } from '../../logging';
import { PlanFinalizeRequest, PlanFinalizeResponse } from '@mealplanner/generated/agent_pb';

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

export function planFinalize(
    call: grpc.ServerUnaryCall<PlanFinalizeRequest, PlanFinalizeResponse>,
    callback: grpc.sendUnaryData<PlanFinalizeResponse>,
): void {
    (async () => {
        try {
            const request = call.request;
            const threadId = request.threadId;
            if (!threadId) return callback(new Error('threadId required'));
            const agent = await initializeAgent();
            const result = await agent.resumeWorkflow(threadId, {});
            const resp = new PlanFinalizeResponse({
                success: result.success,
                message: result.message || '',
            });
            callback(null, resp);
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            await debugLog(`Error in planFinalize: ${errMsg}`);
            callback(new Error(`Error in planFinalize: ${errMsg}`));
        }
    })();
}


