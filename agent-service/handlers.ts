import * as grpc from '@grpc/grpc-js';
import { LangGraphAgent } from './langgraph-agent';
import { debugLog } from './logging';
import { WorkflowType, MealPlanningState } from './shared/types';
import {
  PlanStartRequest,
  PlanStartResponse,
} from '@mealplanner/generated/agent_pb';

// Initialize or retrieve the singleton agent
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
      const participants = request.participants || [];
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
      await debugLog(`🔄 Got a threadId: ${threadId}`);
      let initialState: MealPlanningState | any;
      try {
        initialState = await agent.getWorkflowState(threadId);
      } catch (e) {
        await debugLog(`Failed to fetch initial workflow state: ${e}`);
        return callback(e as Error);
      }
      // Normalize missing dayIndex values to 0 to satisfy client expectations/tests
      if (initialState?.mealPlan?.days && Array.isArray(initialState.mealPlan.days)) {
        initialState.mealPlan.days = initialState.mealPlan.days.map((d: any) => ({
          ...d,
          dayIndex: typeof d?.dayIndex === 'number' ? d.dayIndex : 0,
        }));
      }
      const stateString =
        typeof (initialState as any).toJsonString === 'function'
          ? (initialState as any).toJsonString({ emitDefaultValues: true })
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
