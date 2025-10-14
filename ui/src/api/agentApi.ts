import { MealPlanningCheckpointState } from '@mealplanner/generated/api_pb';
import type { GoMealPlan, GoCheckpointTuple } from '@mealplanner/generated/gateway/types.gen';
import {
  createClient,
  createConfig,
} from '@mealplanner/generated/gateway/client';
import {
  postAgentStart,
  postAgentMessage,
  getCheckpointsByThreadId,
  getWorkflowsByThreadIdMessages,
} from '@mealplanner/generated/gateway';

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

type GatewayInitialState = {
  state?: { mealPlan?: GoMealPlan };
  mealPlan?: (GoMealPlan & { shoppingList?: unknown }) | undefined;
};

export interface SendMessageResult {
  message?: string;
  // API may return a checkpoint-like object with nested state or a top-level mealPlan
  initialState?: MealPlanningCheckpointState | GatewayInitialState;
}

/**
 * Start a new agent session
 */
export async function startAgentSession(
  participants: string[] = ['user'],
  workflowType: string = 'meal_planning',
): Promise<StartSessionResult> {
  const result = await postAgentStart({
    client: gatewayClient,
    body: {
      participants,
      workflowType,
    },
  });

  if (result.error) {
    throw new Error(
      `Failed to start agent session: ${formatGatewayError(result.error)}`,
    );
  }

  const data = result.data;
  if (!data) {
    throw new Error('Failed to start agent session: empty response');
  }

  const agentResponse = data.response;
  if (!agentResponse || !agentResponse.threadId || !agentResponse.currentStep) {
    throw new Error('Invalid agent response - missing required fields');
  }

  const session: SessionInfo = {
    threadId: agentResponse.threadId,
    currentStep: agentResponse.currentStep,
  };

  let initialState: MealPlanningCheckpointState | undefined;
  if (typeof agentResponse.initialState === 'string') {
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

  if (result.error) {
    throw new Error(`Failed to send message: ${formatGatewayError(result.error)}`);
  }

  const data = result.data;
  if (!data) {
    throw new Error('Failed to send message: empty response');
  }

  const agentResponse = data.response;
  if (!agentResponse) {
    throw new Error('No response from agent');
  }

  let initialState: SendMessageResult['initialState'];
  if (typeof agentResponse.initialState === 'string') {
    try {
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

  if (result.error) {
    throw new Error(`Failed to get agent checkpoint: ${formatGatewayError(result.error)}`);
  }

  const data = result.data;
  if (!data) {
    throw new Error('Failed to get agent checkpoint: empty response');
  }

  const tupleLike = data.tuple;
  let tuple: GoCheckpointTuple | undefined;
  if (typeof tupleLike === 'string') {
    try {
      tuple = JSON.parse(tupleLike) as GoCheckpointTuple;
    } catch {
      throw new Error('Failed to parse checkpoint tuple');
    }
  } else {
    tuple = tupleLike;
  }

  if (!tuple?.checkpoint) {
    throw new Error('Failed to get agent checkpoint - no checkpoint data');
  }

  return tuple.checkpoint;
}

/**
 * Get messages for a workflow thread
 */
import type { GoMessage } from '@mealplanner/generated/gateway/types.gen';
export async function getMessages(threadId: string): Promise<GoMessage[]> {
  const result = await getWorkflowsByThreadIdMessages({
    client: gatewayClient,
    path: { threadId },
  });

  if (result.error) {
    throw new Error(`Failed to get messages: ${formatGatewayError(result.error)}`);
  }

  return result.data?.messages ?? [];
}
