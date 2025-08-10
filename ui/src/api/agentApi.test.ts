import {
  startAgentSession,
  sendAgentMessage,
  getAgentCheckpoint,
  getMessages,
} from './agentApi';
import * as gatewayModule from '@mealplanner/generated/dist/gateway/index.js';

jest.mock('@mealplanner/generated/dist/gateway/index.js');
jest.mock('@mealplanner/generated/dist/gateway/client/index.js', () => ({
  createClient: jest.fn(() => 'mockClient'),
  createConfig: jest.fn(() => ({})),
}));

const mockedGateway = gatewayModule as jest.Mocked<typeof gatewayModule>;

describe('agentApi', () => {
  const mockAgentResponse = {
    threadId: 'test-thread-123',
    currentStep: 'initial',
    message: 'Welcome to meal planning',
    initialState: JSON.stringify({ step: 'start', data: {} }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startAgentSession', () => {
    it('should start agent session with default parameters', async () => {
      mockedGateway.postAgentStart.mockResolvedValue({
        data: { response: mockAgentResponse },
        error: null,
      } as any);

      const result = await startAgentSession();

      expect(result.session.threadId).toBe('test-thread-123');
      expect(result.session.currentStep).toBe('initial');
      expect(result.message).toBe('Welcome to meal planning');
      expect(result.initialState).toEqual({ step: 'start', data: {} });

      expect(mockedGateway.postAgentStart).toHaveBeenCalledWith({
        client: 'mockClient',
        body: {
          participants: ['user'],
          workflowType: 'meal_planning',
        },
      });
    });

    it('should start agent session with custom parameters', async () => {
      mockedGateway.postAgentStart.mockResolvedValue({
        data: { response: mockAgentResponse },
        error: null,
      } as any);

      const participants = ['user', 'agent'];
      const workflowType = 'custom_workflow';

      const result = await startAgentSession(participants, workflowType);

      expect(result.session.threadId).toBe('test-thread-123');
      expect(mockedGateway.postAgentStart).toHaveBeenCalledWith({
        client: 'mockClient',
        body: {
          participants,
          workflowType,
        },
      });
    });

    it('should handle session without initial state', async () => {
      const responseWithoutState = {
        ...mockAgentResponse,
        initialState: undefined,
      };

      mockedGateway.postAgentStart.mockResolvedValue({
        data: { response: responseWithoutState },
        error: null,
      } as any);

      const result = await startAgentSession();

      expect(result.initialState).toBeUndefined();
    });

    it('should handle invalid JSON in initial state', async () => {
      const responseWithInvalidState = {
        ...mockAgentResponse,
        initialState: 'invalid-json{',
      };

      mockedGateway.postAgentStart.mockResolvedValue({
        data: { response: responseWithInvalidState },
        error: null,
      } as any);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await startAgentSession();

      expect(result.initialState).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse initial state:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it('should throw error when API returns error', async () => {
      mockedGateway.postAgentStart.mockResolvedValue({
        data: null,
        error: 'Session creation failed',
      } as any);

      await expect(startAgentSession()).rejects.toThrow(
        'Failed to start agent session: Session creation failed',
      );
    });

    it('should throw error when no data returned', async () => {
      mockedGateway.postAgentStart.mockResolvedValue({
        data: null,
        error: null,
      } as any);

      await expect(startAgentSession()).rejects.toThrow(
        'Failed to start agent session: Unknown error',
      );
    });

    it('should throw error when no response in data', async () => {
      mockedGateway.postAgentStart.mockResolvedValue({
        data: {},
        error: null,
      } as any);

      await expect(startAgentSession()).rejects.toThrow(
        'No response from agent',
      );
    });

    it('should throw error when response missing threadId', async () => {
      const invalidResponse = {
        ...mockAgentResponse,
        threadId: undefined,
      };

      mockedGateway.postAgentStart.mockResolvedValue({
        data: { response: invalidResponse },
        error: null,
      } as any);

      await expect(startAgentSession()).rejects.toThrow(
        'Invalid agent response - missing required fields',
      );
    });

    it('should throw error when response missing currentStep', async () => {
      const invalidResponse = {
        ...mockAgentResponse,
        currentStep: undefined,
      };

      mockedGateway.postAgentStart.mockResolvedValue({
        data: { response: invalidResponse },
        error: null,
      } as any);

      await expect(startAgentSession()).rejects.toThrow(
        'Invalid agent response - missing required fields',
      );
    });

    it('should throw error when response missing both required fields', async () => {
      const invalidResponse = {
        ...mockAgentResponse,
        threadId: null,
        currentStep: '',
      };

      mockedGateway.postAgentStart.mockResolvedValue({
        data: { response: invalidResponse },
        error: null,
      } as any);

      await expect(startAgentSession()).rejects.toThrow(
        'Invalid agent response - missing required fields',
      );
    });
  });

  describe('sendAgentMessage', () => {
    const mockMessageResponse = {
      message: 'Agent response message',
      initialState: JSON.stringify({
        step: 'processing',
        data: { key: 'value' },
      }),
    };

    it('should send message with default parameters', async () => {
      mockedGateway.postAgentMessage.mockResolvedValue({
        data: { response: mockMessageResponse },
        error: null,
      } as any);

      const result = await sendAgentMessage('test-thread-123', 'Hello');

      expect(result.message).toBe('Agent response message');
      expect(result.initialState).toEqual({
        step: 'processing',
        data: { key: 'value' },
      });

      expect(mockedGateway.postAgentMessage).toHaveBeenCalledWith({
        client: 'mockClient',
        body: {
          threadId: 'test-thread-123',
          message: 'Hello',
          from: 'user',
          interactive: false,
        },
      });
    });

    it('should send message with custom parameters', async () => {
      mockedGateway.postAgentMessage.mockResolvedValue({
        data: { response: mockMessageResponse },
        error: null,
      } as any);

      const result = await sendAgentMessage(
        'test-thread-123',
        'Hello',
        'system',
        true,
      );

      expect(result.message).toBe('Agent response message');

      expect(mockedGateway.postAgentMessage).toHaveBeenCalledWith({
        client: 'mockClient',
        body: {
          threadId: 'test-thread-123',
          message: 'Hello',
          from: 'system',
          interactive: true,
        },
      });
    });

    it('should handle response without initial state', async () => {
      const responseWithoutState = {
        ...mockMessageResponse,
        initialState: undefined,
      };

      mockedGateway.postAgentMessage.mockResolvedValue({
        data: { response: responseWithoutState },
        error: null,
      } as any);

      const result = await sendAgentMessage('test-thread-123', 'Hello');

      expect(result.initialState).toBeUndefined();
    });

    it('should handle invalid JSON in initial state', async () => {
      const responseWithInvalidState = {
        ...mockMessageResponse,
        initialState: 'invalid-json}',
      };

      mockedGateway.postAgentMessage.mockResolvedValue({
        data: { response: responseWithInvalidState },
        error: null,
      } as any);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await sendAgentMessage('test-thread-123', 'Hello');

      expect(result.initialState).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse initial state:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it('should throw error when API returns error', async () => {
      mockedGateway.postAgentMessage.mockResolvedValue({
        data: null,
        error: 'Message sending failed',
      } as any);

      await expect(
        sendAgentMessage('test-thread-123', 'Hello'),
      ).rejects.toThrow('Failed to send message: Message sending failed');
    });

    it('should throw error when no data returned', async () => {
      mockedGateway.postAgentMessage.mockResolvedValue({
        data: null,
        error: null,
      } as any);

      await expect(
        sendAgentMessage('test-thread-123', 'Hello'),
      ).rejects.toThrow('Failed to send message: Unknown error');
    });

    it('should throw error when no response in data', async () => {
      mockedGateway.postAgentMessage.mockResolvedValue({
        data: {},
        error: null,
      } as any);

      await expect(
        sendAgentMessage('test-thread-123', 'Hello'),
      ).rejects.toThrow('No response from agent');
    });
  });

  describe('getAgentCheckpoint', () => {
    const mockCheckpointData = {
      step: 'planning',
      state: { meals: [], preferences: {} },
    };

    it('should get checkpoint successfully', async () => {
      mockedGateway.getCheckpointsByThreadId.mockResolvedValue({
        data: {
          tuple: {
            checkpoint: mockCheckpointData,
          },
        },
        error: null,
      } as any);

      const result = await getAgentCheckpoint('test-thread-123');

      expect(result).toEqual(mockCheckpointData);
      expect(mockedGateway.getCheckpointsByThreadId).toHaveBeenCalledWith({
        client: 'mockClient',
        path: { thread_id: 'test-thread-123' },
      });
    });

    it('should handle string-encoded tuple', async () => {
      const tupleString = JSON.stringify({
        checkpoint: mockCheckpointData,
      });

      mockedGateway.getCheckpointsByThreadId.mockResolvedValue({
        data: {
          tuple: tupleString,
        },
        error: null,
      } as any);

      const result = await getAgentCheckpoint('test-thread-123');

      expect(result).toEqual(mockCheckpointData);
    });

    it('should throw error when API returns error object', async () => {
      const errorObject = new Error('Checkpoint not found');
      mockedGateway.getCheckpointsByThreadId.mockResolvedValue({
        data: null,
        error: errorObject,
      } as any);

      await expect(getAgentCheckpoint('test-thread-123')).rejects.toThrow(
        errorObject,
      );
    });

    it('should throw error when API returns error string', async () => {
      mockedGateway.getCheckpointsByThreadId.mockResolvedValue({
        data: null,
        error: 'Database connection failed',
      } as any);

      await expect(getAgentCheckpoint('test-thread-123')).rejects.toBe(
        'Database connection failed',
      );
    });

    it('should throw error when no data returned', async () => {
      mockedGateway.getCheckpointsByThreadId.mockResolvedValue({
        data: null,
        error: null,
      } as any);

      await expect(getAgentCheckpoint('test-thread-123')).rejects.toThrow(
        'Failed to get agent checkpoint',
      );
    });

    it('should throw error when no tuple in data', async () => {
      mockedGateway.getCheckpointsByThreadId.mockResolvedValue({
        data: {},
        error: null,
      } as any);

      await expect(getAgentCheckpoint('test-thread-123')).rejects.toThrow(
        'Failed to get agent checkpoint - no checkpoint data',
      );
    });

    it('should throw error when tuple has no checkpoint', async () => {
      mockedGateway.getCheckpointsByThreadId.mockResolvedValue({
        data: {
          tuple: {},
        },
        error: null,
      } as any);

      await expect(getAgentCheckpoint('test-thread-123')).rejects.toThrow(
        'Failed to get agent checkpoint - no checkpoint data',
      );
    });

    it('should throw error when tuple is null', async () => {
      mockedGateway.getCheckpointsByThreadId.mockResolvedValue({
        data: {
          tuple: null,
        },
        error: null,
      } as any);

      await expect(getAgentCheckpoint('test-thread-123')).rejects.toThrow(
        'Failed to get agent checkpoint - no checkpoint data',
      );
    });
  });

  describe('getMessages', () => {
    const mockMessages = [
      {
        id: '1',
        content: 'Hello',
        from: 'user',
        timestamp: '2023-01-01T00:00:00Z',
      },
      {
        id: '2',
        content: 'Hi there!',
        from: 'agent',
        timestamp: '2023-01-01T00:01:00Z',
      },
    ];

    it('should get messages successfully', async () => {
      mockedGateway.getWorkflowsByThreadIdMessages.mockResolvedValue({
        data: { messages: mockMessages },
        error: null,
      } as any);

      const result = await getMessages('test-thread-123');

      expect(result).toEqual(mockMessages);
      expect(mockedGateway.getWorkflowsByThreadIdMessages).toHaveBeenCalledWith(
        {
          client: 'mockClient',
          path: { threadId: 'test-thread-123' },
        },
      );
    });

    it('should return empty array when no messages', async () => {
      mockedGateway.getWorkflowsByThreadIdMessages.mockResolvedValue({
        data: {},
        error: null,
      } as any);

      const result = await getMessages('test-thread-123');

      expect(result).toEqual([]);
    });

    it('should return empty array when messages is null', async () => {
      mockedGateway.getWorkflowsByThreadIdMessages.mockResolvedValue({
        data: { messages: null },
        error: null,
      } as any);

      const result = await getMessages('test-thread-123');

      expect(result).toEqual([]);
    });

    it('should throw error when API returns error object', async () => {
      const errorObject = new Error('Thread not found');
      mockedGateway.getWorkflowsByThreadIdMessages.mockResolvedValue({
        data: null,
        error: errorObject,
      } as any);

      await expect(getMessages('test-thread-123')).rejects.toThrow(errorObject);
    });

    it('should throw error when API returns error string', async () => {
      mockedGateway.getWorkflowsByThreadIdMessages.mockResolvedValue({
        data: null,
        error: 'Access denied',
      } as any);

      await expect(getMessages('test-thread-123')).rejects.toBe(
        'Access denied',
      );
    });

    it('should throw error when no data returned', async () => {
      mockedGateway.getWorkflowsByThreadIdMessages.mockResolvedValue({
        data: null,
        error: null,
      } as any);

      await expect(getMessages('test-thread-123')).rejects.toThrow(
        'Failed to get messages',
      );
    });
  });
});
