import * as grpc from '@grpc/grpc-js';
import * as path from 'path';
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
    agentInstance = new LangGraphAgent({ defaultParticipants: ['brad', 'shannon'] });
    await agentInstance.initialize();
  }
  return agentInstance;
}

// Validate UUID thread IDs
function validateThreadId(threadId: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(threadId);
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
      let initialState: MealPlanningState;
      try {
        initialState = await agent.getWorkflowState(threadId);
      } catch (e) {
        await debugLog(`Failed to fetch initial workflow state: ${e}`);
        return callback(e as Error);
      }
      // Serialize initial state and fill missing dayIndex defaults
      let rawStateJson: string;
      if (typeof (initialState as any).toJsonString === 'function') {
        rawStateJson = (initialState as any).toJsonString();
      } else {
        rawStateJson = JSON.stringify(initialState);
      }
      const parsed: any = JSON.parse(rawStateJson);
      if (parsed.mealPlan?.days && Array.isArray(parsed.mealPlan.days)) {
        parsed.mealPlan.days.forEach((day: any, idx: number) => {
          if (day.dayIndex === undefined || !day.hasOwnProperty('dayIndex')) {
            day.dayIndex = idx;
          }
        });
      }
      const stateString = JSON.stringify(parsed);
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