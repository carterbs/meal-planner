import { MealPlanningCheckpointState } from '@mealplanner/generated/api_pb';
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
import type {
  GoStartAgentWorkflowResponse,
  GoMessageAgentResponse,
  GoGetCheckpointResponse,
  GoGetMessagesResponse,
} from '@mealplanner/generated/gateway/types.gen';
import type { AgentMessage } from '../utils/gatewayGuards';
import {
  formatGatewayError,
  parseAgentMessageResponse,
  parseAgentStartResponse,
  parseCheckpointResponse,
  parseCheckpointState,
  parseMessagesResponse,
} from '../utils/gatewayGuards';
import type {
  GoStartAgentWorkflowResponse,
  GoMessageAgentResponse,
  GoGetCheckpointResponse,
  GoGetMessagesResponse,
} from '@mealplanner/generated/gateway/types.gen';

const gatewayClient: ReturnType<typeof createClient> = createClient(
  createConfig({
    baseUrl: 'http://localhost:8090/api',
  }),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getField(record: Record<string, unknown>, key: string): unknown {
  return record[key];
}

async function unwrapGatewayResult<T>(
  promise: Promise<unknown>,
  context: string,
): Promise<T> {
  const envelope = await promise;
  if (!isRecord(envelope)) {
    throw new Error(`${context}: invalid response envelope`);
  }

  const errorValue = getField(envelope, 'error');
  if (errorValue != null) {
    throw new Error(`${context}: ${formatGatewayError(errorValue)}`);
  }

  const dataValue = getField(envelope, 'data');
  if (dataValue == null) {
    throw new Error(`${context}: empty response`);
  }

  return dataValue as T;
}

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
  initialState?: MealPlanningCheckpointState;
}

export async function startAgentSession(
  participants: string[] = ['user'],
  workflowType: string = 'meal_planning',
): Promise<StartSessionResult> {
  const data = await unwrapGatewayResult<GoStartAgentWorkflowResponse>(
    postAgentStart({
      client: gatewayClient,
      body: {
        participants,
        workflowType,
      },
    }),
    'Failed to start agent session',
  );

  const payload = parseAgentStartResponse(data);

  let initialState: MealPlanningCheckpointState | undefined;
  try {
    initialState = parseCheckpointState(
      payload.initialState,
      'agent start initial state',
    );
  } catch (parseError) {
    const warnError =
      parseError instanceof Error
        ? parseError
        : new Error(String(parseError));
    console.warn('Failed to parse initial state:', warnError);
  }

  return {
    session: {
      threadId: payload.threadId,
      currentStep: payload.currentStep,
    },
    initialState,
    message: payload.message,
  };
}

export async function sendAgentMessage(
  threadId: string,
  message: string,
  from: string = 'user',
  interactive: boolean = false,
): Promise<SendMessageResult> {
  const data = await unwrapGatewayResult<GoMessageAgentResponse>(
    postAgentMessage({
      client: gatewayClient,
      body: {
        threadId,
        message,
        from,
        interactive,
      },
    }),
    'Failed to send message',
  );

  const payload = parseAgentMessageResponse(data);

  let initialState: MealPlanningCheckpointState | undefined;
  try {
    initialState = parseCheckpointState(
      payload.initialState,
      'agent message initial state',
    );
  } catch (parseError) {
    const warnError =
      parseError instanceof Error
        ? parseError
        : new Error(String(parseError));
    console.warn('Failed to parse initial state:', warnError);
  }

  return {
    message: payload.message,
    initialState,
  };
}

export async function getAgentCheckpoint(
  threadId: string,
): Promise<MealPlanningCheckpointState | undefined> {
  const data = await unwrapGatewayResult<GoGetCheckpointResponse>(
    getCheckpointsByThreadId({
      client: gatewayClient,
      path: { thread_id: threadId },
    }),
    'Failed to get agent checkpoint',
  );

  return parseCheckpointResponse(data);
}

export async function getMessages(threadId: string): Promise<AgentMessage[]> {
  const data = await unwrapGatewayResult<GoGetMessagesResponse>(
    getWorkflowsByThreadIdMessages({
      client: gatewayClient,
      path: { threadId },
    }),
    'Failed to get messages',
  );

  return parseMessagesResponse(data);
}
