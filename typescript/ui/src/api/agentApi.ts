import {
  StartAgentWorkflowRequest,
  StartAgentWorkflowResponse,
  MessageAgentRequest,
  MessageAgentResponse,
  AgentStartRequest,
  AgentMessageRequest,
} from '@mealplanner/generated';

export interface SessionInfo {
  threadId: string;
  currentStep: string;
}

export interface StartSessionResult {
  session: SessionInfo;
  initialState?: any;
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
  const requestData: AgentStartRequest = {
    participants,
    workflowType,
  };

  const response = await fetch('/api/agent/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      StartAgentWorkflowRequest.toJSON({ request: requestData }),
    ),
  });

  if (!response.ok) {
    throw new Error(`Failed to start agent session: ${response.statusText}`);
  }

  const responseJson = await response.json();
  const data = StartAgentWorkflowResponse.fromJSON(responseJson);
  const agentResponse = data.response;

  if (!agentResponse) {
    throw new Error('No response from agent');
  }

  const session: SessionInfo = {
    threadId: agentResponse.threadId,
    currentStep: agentResponse.currentStep,
  };

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
  const requestData: AgentMessageRequest = {
    threadId,
    message,
    from,
    interactive,
  };

  const response = await fetch('/api/agent/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(MessageAgentRequest.toJSON({ request: requestData })),
  });

  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.statusText}`);
  }

  const responseJson = await response.json();
  const data = MessageAgentResponse.fromJSON(responseJson);
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
