import { MealPlanningCheckpointState } from '@mealplanner/generated';
import type { GoMealPlanEntry } from '@mealplanner/generated/dist/gateway/types.gen';
import type { GoCheckpointTuple } from '@mealplanner/generated/dist/gateway/types.gen';
import {
  createClient,
  createConfig,
} from '@mealplanner/generated/dist/gateway/client';
import {
  postAgentStart,
  postAgentMessage,
  getCheckpointsByThreadId,
  getWorkflowsByThreadIdMessages,
} from '@mealplanner/generated/dist/gateway';

// Create the API gateway client
const gatewayClient = createClient(
  createConfig({
    baseUrl: 'http://localhost:8090/api',
  }),
);

export interface SessionInfo {
  threadId: string;
  currentStep: string;
}

export interface StartSessionResult {
  session: SessionInfo;
  initialState?: MealPlanningCheckpointState;
  message?: string;
}

export interface SendMessageResult {
  message?: string;
  // API may return a checkpoint-like object with nested state or a top-level mealPlan
  initialState?: {
    state?: { mealPlan?: { days?: GoMealPlanEntry[] } };
    mealPlan?: { shoppingList?: unknown }
  } | MealPlanningCheckpointState;
}

/**
 * Start a new agent session
 */
export async function startAgentSession(
  participants: string[] = ['user'],
  workflowType: string = 'meal_planning',
): Promise<StartSessionResult> {
  const requestData = {
    participants,
    workflowType,
  };

  const result = await postAgentStart({
    client: gatewayClient,
    body: requestData,
  });

  const resStart = result as unknown as { data?: { response?: unknown }; error?: unknown };
  if (!resStart.data || resStart.error) {
    const msg = typeof resStart.error === 'string' ? resStart.error : resStart.error != null ? String(resStart.error) : 'Unknown error';
    throw new Error(`Failed to start agent session: ${msg}`);
  }

  const data = resStart.data as { response?: { threadId?: string; currentStep?: string; initialState?: string; message?: string } };

  if (!data.response) {
    throw new Error('No response from agent');
  }

  const agentResponse = data.response;

  if (!agentResponse.threadId || !agentResponse.currentStep) {
    throw new Error('Invalid agent response - missing required fields');
  }

  const session: SessionInfo = {
    threadId: agentResponse.threadId,
    currentStep: agentResponse.currentStep,
  };

  let initialState: MealPlanningCheckpointState | undefined;
  if (agentResponse.initialState) {
    try {
      initialState = JSON.parse(agentResponse.initialState) as MealPlanningCheckpointState;
    } catch (error) {
      console.warn('Failed to parse initial state:', error);
    }
  }

  return {
    session,
    initialState,
    message: agentResponse.message,
  };
}

/**
 * Send a message to an existing agent session
 */
export async function sendAgentMessage(
  threadId: string,
  message: string,
  from: string = 'user',
  interactive: boolean = false,
): Promise<SendMessageResult> {
  const requestData = {
    threadId,
    message,
    from,
    interactive,
  };

  const result = await postAgentMessage({
    client: gatewayClient,
    body: requestData,
  });

  const resMsg = result as unknown as { data?: { response?: unknown }; error?: unknown };
  if (!resMsg.data || resMsg.error) {
    const msg = typeof resMsg.error === 'string' ? resMsg.error : resMsg.error != null ? String(resMsg.error) : 'Unknown error';
    throw new Error(`Failed to send message: ${msg}`);
  }

  const data = resMsg.data as { response?: { message?: string; initialState?: string } };

  if (!data.response) {
    throw new Error('No response from agent');
  }

  const agentResponse = data.response;

  let initialState: SendMessageResult['initialState'];
  if (agentResponse.initialState) {
    try {
      // API may return either a MealPlanningCheckpointState or a nested object
      initialState = JSON.parse(agentResponse.initialState) as SendMessageResult['initialState'];
    } catch (error) {
      console.warn('Failed to parse initial state:', error);
    }
  }

  return {
    message: agentResponse.message,
    initialState,
  };
}

// get agent checkpoint
export async function getAgentCheckpoint(threadId: string) {
  const result = await getCheckpointsByThreadId({
    client: gatewayClient,
    path: { thread_id: threadId },
  });
  const possibleError = (result as unknown as { error?: unknown }).error;
  if (!result.data) {
    if (possibleError) throw possibleError as Error;
    throw new Error('Failed to get agent checkpoint');
  }

  // Handle case where tuple might be string-encoded
  let tuple: GoCheckpointTuple | string | undefined = result.data.tuple;
  if (typeof tuple === 'string') {
    try {
      tuple = JSON.parse(tuple) as GoCheckpointTuple;
    } catch {
      throw new Error('Failed to parse checkpoint tuple');
    }
  }

  if (!tuple || typeof tuple !== 'object' || !('checkpoint' in tuple)) {
    throw new Error('Failed to get agent checkpoint - no checkpoint data');
  }

  return tuple.checkpoint;
}

/**
 * Get messages for a workflow thread
 */
import type { GoMessage } from '@mealplanner/generated/dist/gateway/types.gen';
export async function getMessages(threadId: string): Promise<GoMessage[]> {
  const result = await getWorkflowsByThreadIdMessages({
    client: gatewayClient,
    path: { threadId },
  });

  const res = result as unknown as { data?: { messages?: unknown[] | null }; error?: unknown };
  if (!res.data) {
    if (res.error) {
      throw res.error;
    }
    throw new Error('Failed to get messages');
  }

  return (res.data.messages || []) as GoMessage[];
}
