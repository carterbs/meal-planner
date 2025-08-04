import {
  MealPlanningCheckpointState,
} from '@mealplanner/generated';
import {
  createClient,
  createConfig,
} from '@mealplanner/generated/dist/gateway/client/index.js';
import {
  postAgentStart,
  postAgentMessage,
  getCheckpointsByThreadId,
  getWorkflowsByThreadIdMessages,
} from '@mealplanner/generated/dist/gateway/index.js';

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
  initialState?: any;
}

/**
 * Start a new agent session
 */
export async function startAgentSession(
  participants: string[] = ['user'],
  workflowType: string = 'meal_planning',
): Promise<StartSessionResult> {
  const requestData = {
    request: {
      participants,
      workflowType,
    }
  };

  const result = await postAgentStart({
    client: gatewayClient,
    body: requestData,
  });

  if (!result.data || result.error) {
    throw new Error(
      `Failed to start agent session: ${result.error || 'Unknown error'}`,
    );
  }

  const data = result.data;
  const agentResponse = data.response;

  if (!agentResponse) {
    throw new Error('No response from agent');
  }

  if (!agentResponse.threadId || !agentResponse.currentStep) {
    throw new Error('Invalid agent response - missing required fields');
  }

  const session: SessionInfo = {
    threadId: agentResponse.threadId,
    currentStep: agentResponse.currentStep,
  };

  debugger;
  let initialState;
  if (agentResponse.initialState) {
    try {
      initialState = JSON.parse(agentResponse.initialState);
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
    request: {
      threadId,
      message,
      from,
      interactive,
    }
  };

  const result = await postAgentMessage({
    client: gatewayClient,
    body: requestData,
  });

  if (!result.data || result.error) {
    throw new Error(
      `Failed to send message: ${result.error || 'Unknown error'}`,
    );
  }

  const data = result.data;
  const agentResponse = data.response;

  if (!agentResponse) {
    throw new Error('No response from agent');
  }

  let initialState;
  if (agentResponse.initialState) {
    try {
      initialState = JSON.parse(agentResponse.initialState);
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
  if (
    !result.data ||
    result.error ||
    !result.data.tuple ||
    !result.data.tuple.checkpoint
  ) {
    if (result.error) {
      throw result.error;
    }
    throw new Error('Failed to get agent checkpoint');
  }
  return result.data.tuple.checkpoint;
}

/**
 * Get messages for a workflow thread
 */
export async function getMessages(threadId: string) {
  const result = await getWorkflowsByThreadIdMessages({
    client: gatewayClient,
    path: { threadId },
  });

  if (!result.data || result.error) {
    if (result.error) {
      throw result.error;
    }
    throw new Error('Failed to get messages');
  }

  return result.data.messages || [];
}
