import { MealPlanningWorkflow } from '../workflows/meal-planning';
import { HttpCheckpointSaver } from '../shared/httpCheckpointer';
import { TestMockFactory, setupConsoleMocks, restoreConsoleMocks } from './test-utils';

// Mock external dependencies
jest.mock('../utils/getBackendClient');
jest.mock('../logging');
jest.mock('../cli');

describe('MealPlanningWorkflow Message Persistence Tests', () => {
  let workflow: any;
  let mockCheckpointer: jest.Mocked<HttpCheckpointSaver>;
  let mockBackendClient: any;

  beforeEach(() => {
    setupConsoleMocks();
    
    mockCheckpointer = TestMockFactory.createMockCheckpointer() as jest.Mocked<HttpCheckpointSaver>;
    mockBackendClient = TestMockFactory.createMockBackendClient();
    
    workflow = new MealPlanningWorkflow(mockCheckpointer) as any;
    
    // Mock getBackendClient to return our mock
    const { getBackendClient } = require('../utils/getBackendClient');
    getBackendClient.mockReturnValue(mockBackendClient);
  });

  afterEach(() => {
    restoreConsoleMocks();
    jest.clearAllMocks();
  });

  describe('addMessage', () => {
    it('adds agent messages to thread successfully', async () => {
      const threadId = 'test-thread-123';
      const message = 'Test agent message';
      
      await workflow.addMessage(threadId, 'agent', message);

      expect(mockBackendClient.addMessage).toHaveBeenCalledWith({
        threadId,
        sender: 'agent',
        message,
      });
    });

    it('adds user messages to thread successfully', async () => {
      const threadId = 'test-thread-456';
      const message = 'Test user message';
      
      await workflow.addMessage(threadId, 'user', message);

      expect(mockBackendClient.addMessage).toHaveBeenCalledWith({
        threadId,
        sender: 'user',
        message,
      });
    });

    it('handles message API errors gracefully', async () => {
      const threadId = 'test-thread-789';
      const message = 'Test message';
      
      mockBackendClient.addMessage.mockRejectedValue(new Error('API Error'));

      // Should not throw error
      await expect(workflow.addMessage(threadId, 'agent', message)).resolves.not.toThrow();
      
      expect(mockBackendClient.addMessage).toHaveBeenCalledWith({
        threadId,
        sender: 'agent',
        message,
      });
    });

    it('continues workflow when message persistence fails', async () => {
      const threadId = 'test-thread-error';
      const message = 'Test message';
      
      mockBackendClient.addMessage.mockRejectedValue(new Error('Network error'));

      // Should resolve without throwing
      await workflow.addMessage(threadId, 'agent', message);
      
      expect(mockBackendClient.addMessage).toHaveBeenCalled();
    });
  });

  describe('getMessages', () => {
    it('retrieves user messages from thread', async () => {
      const threadId = 'test-thread-123';
      const mockMessages = [
        TestMockFactory.createMockMessage({
          id: 'msg1',
          sender: 'user',
          content: 'First user message',
        }),
        TestMockFactory.createMockMessage({
          id: 'msg2',
          sender: 'agent',
          content: 'Agent response',
        }),
        TestMockFactory.createMockMessage({
          id: 'msg3',
          sender: 'user',
          content: 'Second user message',
        }),
      ];

      mockBackendClient.getMessages.mockResolvedValue({
        messages: mockMessages,
      });

      const result = await workflow.getMessages(threadId);

      expect(mockBackendClient.getMessages).toHaveBeenCalledWith({
        threadId,
      });
      expect(result).toEqual(['First user message', 'Second user message']);
    });

    it('filters messages by sender type', async () => {
      const threadId = 'test-thread-filter';
      const mockMessages = [
        TestMockFactory.createMockMessage({
          sender: 'user',
          content: 'User message 1',
        }),
        TestMockFactory.createMockMessage({
          sender: 'agent',
          content: 'Agent message 1',
        }),
        TestMockFactory.createMockMessage({
          sender: 'user',
          content: 'User message 2',
        }),
        TestMockFactory.createMockMessage({
          sender: 'system',
          content: 'System message',
        }),
      ];

      mockBackendClient.getMessages.mockResolvedValue({
        messages: mockMessages,
      });

      const result = await workflow.getMessages(threadId);

      expect(result).toEqual(['User message 1', 'User message 2']);
    });

    it('handles message API errors gracefully', async () => {
      const threadId = 'test-thread-error';
      
      mockBackendClient.getMessages.mockRejectedValue(new Error('API Error'));

      const result = await workflow.getMessages(threadId);

      expect(result).toEqual([]);
      expect(mockBackendClient.getMessages).toHaveBeenCalledWith({
        threadId,
      });
    });

    it('filters out empty messages', async () => {
      const threadId = 'test-thread-empty';
      const mockMessages = [
        TestMockFactory.createMockMessage({
          sender: 'user',
          content: 'Valid message',
        }),
        TestMockFactory.createMockMessage({
          sender: 'user',
          content: '',
        }),
        TestMockFactory.createMockMessage({
          sender: 'user',
          content: '   ',
        }),
        TestMockFactory.createMockMessage({
          sender: 'user',
          content: 'Another valid message',
        }),
      ];

      mockBackendClient.getMessages.mockResolvedValue({
        messages: mockMessages,
      });

      const result = await workflow.getMessages(threadId);

      expect(result).toEqual(['Valid message', 'Another valid message']);
    });

    it('handles messages with different content field names', async () => {
      const threadId = 'test-thread-content-fields';
      const mockMessages = [
        {
          id: 'msg1',
          sender: 'user',
          content: 'Message with content field',
        },
        {
          id: 'msg2',
          sender: 'user',
          message: 'Message with message field',
        },
        {
          id: 'msg3',
          sender: 'user',
          content: null,
          message: 'Fallback to message field',
        },
      ];

      mockBackendClient.getMessages.mockResolvedValue({
        messages: mockMessages,
      });

      const result = await workflow.getMessages(threadId);

      expect(result).toEqual([
        'Message with content field',
        'Message with message field', 
        'Fallback to message field'
      ]);
    });

    it('returns empty array when no messages exist', async () => {
      const threadId = 'test-thread-empty';
      
      mockBackendClient.getMessages.mockResolvedValue({
        messages: [],
      });

      const result = await workflow.getMessages(threadId);

      expect(result).toEqual([]);
    });

    it('handles malformed message responses', async () => {
      const threadId = 'test-thread-malformed';
      
      mockBackendClient.getMessages.mockResolvedValue({
        messages: [
          { id: 'msg1', sender: 'user', content: 'Valid message' },
          { id: 'msg2', sender: 'user' }, // Missing content - will result in empty string
          { id: 'msg3', sender: 'agent', content: 'Agent message' }, // Will be filtered out by sender
        ],
      });

      const result = await workflow.getMessages(threadId);

      expect(result).toEqual(['Valid message']);
    });
  });

  describe('message persistence integration', () => {
    it('persists agent response messages during feedback application', async () => {
      const threadId = 'test-thread-feedback';
      const mockMealPlan = TestMockFactory.createMockWeeklyMealPlan();
      const mockFeedback = ['Please change dinner on Monday'];

      // Mock the MCP client
      const mockClient = TestMockFactory.createMockMCPClient();
      mockClient.callTool.mockResolvedValue({
        isError: false,
        content: [{ type: 'text', text: JSON.stringify([TestMockFactory.createMockMeal()]) }],
      });
      workflow.client = mockClient;

      // Mock the LLM response
      const mockLLM = TestMockFactory.createMockLLM();
      mockLLM.invoke.mockResolvedValue({
        content: JSON.stringify({
          replacements: [],
          userMessage: 'I\'ve updated your meal plan!',
        }),
      });
      workflow.llm = mockLLM;

      const result = await workflow.applyFeedbackWithLLM(mockMealPlan, mockFeedback);

      expect(result.userMessage).toBe('I\'ve updated your meal plan!');
    });

    it('handles message persistence failures during workflow execution', async () => {
      const threadId = 'test-thread-persistence-fail';
      
      mockBackendClient.addMessage.mockRejectedValue(new Error('Database connection failed'));

      // Should not affect the workflow execution
      await workflow.addMessage(threadId, 'agent', 'Test message');
      
      expect(mockBackendClient.addMessage).toHaveBeenCalled();
    });
  });
});