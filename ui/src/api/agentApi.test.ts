import {
  startAgentSession,
  sendAgentMessage,
  getAgentCheckpoint,
  getMessages,
} from './agentApi';
import { MealPlanningCheckpointState } from '@mealplanner/generated/api_pb';
import * as gatewayModule from '@mealplanner/generated/gateway';

jest.mock('@mealplanner/generated/gateway');
jest.mock('@mealplanner/generated/gateway/client', () => ({
  createClient: jest.fn(() => 'mockClient'),
  createConfig: jest.fn(() => ({})),
}));

const mockedGateway = gatewayModule as jest.Mocked<typeof gatewayModule>;

describe('agentApi', () => {
  const initialStatePayload = {
    threadId: 'test-thread-123',
    currentStep: 'initial',
    mealPlan: { items: [] },
  };

  const mockAgentResponse = {
    threadId: 'test-thread-123',
    currentStep: 'initial',
    message: 'Welcome to meal planning',
    initialState: JSON.stringify(initialStatePayload),
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('startAgentSession', () => {
    it('starts a session with defaults and parses initial state', async () => {
      mockedGateway.postAgentStart.mockResolvedValue({
        data: { response: mockAgentResponse },
        error: undefined,
      } as unknown as Awaited<ReturnType<typeof mockedGateway.postAgentStart>>);

      const result = await startAgentSession();

      expect(result.session).toEqual({
        threadId: 'test-thread-123',
        currentStep: 'initial',
      });
      expect(result.message).toBe('Welcome to meal planning');
      expect(result.initialState).toBeInstanceOf(MealPlanningCheckpointState);
      expect(result.initialState?.threadId).toBe('test-thread-123');

      expect(mockedGateway.postAgentStart).toHaveBeenCalledWith({
        client: 'mockClient',
        body: {
          participants: ['user'],
          workflowType: 'meal_planning',
        },
      });
    });

    it('passes custom participants and workflow type', async () => {
      mockedGateway.postAgentStart.mockResolvedValue({
        data: { response: mockAgentResponse },
        error: undefined,
      } as unknown as Awaited<ReturnType<typeof mockedGateway.postAgentStart>>);

      await startAgentSession(['user', 'assistant'], 'custom');

      expect(mockedGateway.postAgentStart).toHaveBeenCalledWith({
        client: 'mockClient',
        body: {
          participants: ['user', 'assistant'],
          workflowType: 'custom',
        },
      });
    });

    it('logs and ignores invalid initial state JSON', async () => {
      const badState = { ...mockAgentResponse, initialState: 'not-json' };
      mockedGateway.postAgentStart.mockResolvedValue({
        data: { response: badState },
        error: undefined,
      } as unknown as Awaited<ReturnType<typeof mockedGateway.postAgentStart>>);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await startAgentSession();

      expect(result.initialState).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to parse initial state:',
        expect.any(Error),
      );

      warnSpy.mockRestore();
    });

    it('throws when gateway returns an error', async () => {
      mockedGateway.postAgentStart.mockResolvedValue({
        data: undefined,
        error: 'boom',
      } as unknown as Awaited<ReturnType<typeof mockedGateway.postAgentStart>>);

      await expect(startAgentSession()).rejects.toThrow(
        'Failed to start agent session: boom',
      );
    });

    it('throws when response payload is missing', async () => {
      mockedGateway.postAgentStart.mockResolvedValue({
        data: undefined,
        error: undefined,
      } as unknown as Awaited<ReturnType<typeof mockedGateway.postAgentStart>>);

      await expect(startAgentSession()).rejects.toThrow(
        'Failed to start agent session: empty response',
      );
    });

    it('validates required fields in response', async () => {
      mockedGateway.postAgentStart.mockResolvedValue({
        data: { response: { ...mockAgentResponse, threadId: undefined } },
        error: undefined,
      } as unknown as Awaited<ReturnType<typeof mockedGateway.postAgentStart>>);

      await expect(startAgentSession()).rejects.toThrow(
        'Agent start response missing required fields',
      );
    });
  });

  describe('sendAgentMessage', () => {
    const messageResponse = {
      message: 'Agent reply',
      initialState: JSON.stringify({
        threadId: 'test-thread-123',
        currentStep: 'planning',
        mealPlan: { items: [] },
      }),
    };

    it('sends a message and parses checkpoint state', async () => {
      mockedGateway.postAgentMessage.mockResolvedValue({
        data: { response: messageResponse },
        error: undefined,
      } as unknown as Awaited<ReturnType<typeof mockedGateway.postAgentMessage>>);

      const result = await sendAgentMessage('thread', 'Hello');

      expect(result.message).toBe('Agent reply');
      expect(result.initialState?.currentStep).toBe('planning');
    });

    it('warns and clears invalid initial state', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockedGateway.postAgentMessage.mockResolvedValue({
        data: { response: { ...messageResponse, initialState: '{' } },
        error: undefined,
      } as unknown as Awaited<ReturnType<typeof mockedGateway.postAgentMessage>>);

      const result = await sendAgentMessage('thread', 'Hello');

      expect(result.initialState).toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('propagates gateway errors', async () => {
      mockedGateway.postAgentMessage.mockResolvedValue({
        data: undefined,
        error: 'nope',
      } as unknown as Awaited<ReturnType<typeof mockedGateway.postAgentMessage>>);

      await expect(sendAgentMessage('thread', 'Hello')).rejects.toThrow(
        'Failed to send message: nope',
      );
    });

    it('requires a response payload', async () => {
      mockedGateway.postAgentMessage.mockResolvedValue({
        data: undefined,
        error: undefined,
      } as unknown as Awaited<ReturnType<typeof mockedGateway.postAgentMessage>>);

      await expect(sendAgentMessage('thread', 'Hello')).rejects.toThrow(
        'Failed to send message: empty response',
      );
    });
  });

  describe('getAgentCheckpoint', () => {
    const checkpointState = {
      threadId: 'thread',
      currentStep: 'plan',
      mealPlan: { items: [] },
    };

    it('returns parsed checkpoint state', async () => {
      mockedGateway.getCheckpointsByThreadId.mockResolvedValue({
        data: {
          tuple: {
            checkpoint: {
              state: checkpointState,
            },
          },
        },
        error: undefined,
      } as unknown as Awaited<
        ReturnType<typeof mockedGateway.getCheckpointsByThreadId>
      >);

      const result = await getAgentCheckpoint('thread');
      expect(result).toBeInstanceOf(MealPlanningCheckpointState);
      expect(result?.currentStep).toBe('plan');
    });

    it('handles string encoded tuples', async () => {
      mockedGateway.getCheckpointsByThreadId.mockResolvedValue({
        data: {
          tuple: JSON.stringify({
            checkpoint: { state: checkpointState },
          }),
        },
        error: undefined,
      } as unknown as Awaited<
        ReturnType<typeof mockedGateway.getCheckpointsByThreadId>
      >);

      const result = await getAgentCheckpoint('thread');
      expect(result?.threadId).toBe('thread');
    });

    it('returns undefined when no checkpoint is found', async () => {
      mockedGateway.getCheckpointsByThreadId.mockResolvedValue({
        data: { found: false },
        error: undefined,
      } as unknown as Awaited<
        ReturnType<typeof mockedGateway.getCheckpointsByThreadId>
      >);

      const result = await getAgentCheckpoint('thread');
      expect(result).toBeUndefined();
    });

    it('propagates gateway errors', async () => {
      mockedGateway.getCheckpointsByThreadId.mockResolvedValue({
        data: undefined,
        error: 'fail',
      } as unknown as Awaited<
        ReturnType<typeof mockedGateway.getCheckpointsByThreadId>
      >);

      await expect(getAgentCheckpoint('thread')).rejects.toThrow(
        'Failed to get agent checkpoint: fail',
      );
    });

    it('throws when checkpoint data missing', async () => {
      mockedGateway.getCheckpointsByThreadId.mockResolvedValue({
        data: undefined,
        error: undefined,
      } as unknown as Awaited<
        ReturnType<typeof mockedGateway.getCheckpointsByThreadId>
      >);

      await expect(getAgentCheckpoint('thread')).rejects.toThrow(
        'Failed to get agent checkpoint: empty response',
      );
    });
  });

  describe('getMessages', () => {
    it('maps gateway messages to UI shape', async () => {
      mockedGateway.getWorkflowsByThreadIdMessages.mockResolvedValue({
        data: {
          messages: [
            { sender: 'user', content: 'Hi' },
            { sender: 'agent', message: 'Hello!' },
          ],
        },
        error: undefined,
      } as unknown as Awaited<
        ReturnType<typeof mockedGateway.getWorkflowsByThreadIdMessages>
      >);

      const result = await getMessages('thread');

      expect(result).toEqual([
        { sender: 'user', content: 'Hi', createdAt: undefined, threadId: undefined },
        { sender: 'agent', content: 'Hello!', createdAt: undefined, threadId: undefined },
      ]);
    });

    it('throws when gateway reports an error', async () => {
      mockedGateway.getWorkflowsByThreadIdMessages.mockResolvedValue({
        data: undefined,
        error: 'no messages',
      } as unknown as Awaited<
        ReturnType<typeof mockedGateway.getWorkflowsByThreadIdMessages>
      >);

      await expect(getMessages('thread')).rejects.toThrow(
        'Failed to get messages: no messages',
      );
    });

    it('throws when response payload missing', async () => {
      mockedGateway.getWorkflowsByThreadIdMessages.mockResolvedValue({
        data: undefined,
        error: undefined,
      } as unknown as Awaited<
        ReturnType<typeof mockedGateway.getWorkflowsByThreadIdMessages>
      >);

      await expect(getMessages('thread')).rejects.toThrow(
        'Failed to get messages: empty response',
      );
    });
  });
});
