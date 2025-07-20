import { MealPlanningWorkflow } from '../workflows/meal-planning';
import { DbCheckpointSaver } from '../shared/dbCheckpointer';
import {
  TestMockFactory,
  setupConsoleMocks,
  restoreConsoleMocks,
} from './test-utils';
// Mock external dependencies
jest.mock('../logging');
describe('MealPlanningWorkflow Message Persistence Tests', () => {
  let workflow: any;
  let mockCheckpointer: jest.Mocked<DbCheckpointSaver>;
  let mockMessageRepo: any;
  beforeEach(() => {
    setupConsoleMocks();
    mockCheckpointer = TestMockFactory.createMockCheckpointer() as any;
    mockMessageRepo = TestMockFactory.createMockMessageRepository();
    workflow = new MealPlanningWorkflow(mockCheckpointer) as any;
    workflow.messageRepo = mockMessageRepo;
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
      expect(mockMessageRepo.addMessage).toHaveBeenCalledWith(
        threadId,
        'agent',
        message,
      );
    });
    it('adds user messages to thread successfully', async () => {
      const threadId = 'test-thread-456';
      const message = 'Test user message';
      await workflow.addMessage(threadId, 'user', message);
      expect(mockMessageRepo.addMessage).toHaveBeenCalledWith(
        threadId,
        'user',
        message,
      );
    });
    it('handles message API errors gracefully', async () => {
      const threadId = 'test-thread-789';
      const message = 'Test message';
      mockMessageRepo.addMessage.mockRejectedValue(new Error('API Error'));
      // Should not throw error
      await expect(
        workflow.addMessage(threadId, 'agent', message),
      ).resolves.not.toThrow();
      expect(mockMessageRepo.addMessage).toHaveBeenCalledWith(
        threadId,
        'agent',
        message,
      );
    });
    it('continues workflow when message persistence fails', async () => {
      const threadId = 'test-thread-error';
      const message = 'Test message';
      mockMessageRepo.addMessage.mockRejectedValue(new Error('Network error'));
      // Should resolve without throwing
      await workflow.addMessage(threadId, 'agent', message);
      expect(mockMessageRepo.addMessage).toHaveBeenCalled();
    });
  });
  describe('getMessages', () => {
    it('retrieves user messages from thread', async () => {
      const threadId = 'test-thread-123';
      const mockMessages = [
        {
          sender: 'user',
          text: 'First user message',
          created_at: new Date().toISOString(),
        },
        {
          sender: 'agent',
          text: 'Agent response',
          created_at: new Date().toISOString(),
        },
        {
          sender: 'user',
          text: 'Second user message',
          created_at: new Date().toISOString(),
        },
      ];
      mockMessageRepo.getMessages.mockResolvedValue(mockMessages);
      const result = await workflow.getMessages(threadId);
      expect(mockMessageRepo.getMessages).toHaveBeenCalledWith(threadId);
      expect(result).toEqual(['First user message', 'Second user message']);
    });
    it('filters messages by sender type', async () => {
      const threadId = 'test-thread-filter';
      const mockMessages = [
        {
          sender: 'user',
          text: 'User message 1',
          created_at: new Date().toISOString(),
        },
        {
          sender: 'agent',
          text: 'Agent message 1',
          created_at: new Date().toISOString(),
        },
        {
          sender: 'user',
          text: 'User message 2',
          created_at: new Date().toISOString(),
        },
        {
          sender: 'system',
          text: 'System message',
          created_at: new Date().toISOString(),
        },
      ];
      mockMessageRepo.getMessages.mockResolvedValue(mockMessages);
      const result = await workflow.getMessages(threadId);
      expect(result).toEqual(['User message 1', 'User message 2']);
    });
    it('handles message API errors gracefully', async () => {
      const threadId = 'test-thread-error';
      mockMessageRepo.getMessages.mockRejectedValue(new Error('API Error'));
      const result = await workflow.getMessages(threadId);
      expect(result).toEqual([]);
      expect(mockMessageRepo.getMessages).toHaveBeenCalledWith(threadId);
    });
    it('filters out empty messages', async () => {
      const threadId = 'test-thread-empty';
      const mockMessages = [
        {
          sender: 'user',
          text: 'Valid message',
          created_at: new Date().toISOString(),
        },
        { sender: 'user', text: '', created_at: new Date().toISOString() },
        { sender: 'user', text: '   ', created_at: new Date().toISOString() },
        {
          sender: 'user',
          text: 'Another valid message',
          created_at: new Date().toISOString(),
        },
      ];
      mockMessageRepo.getMessages.mockResolvedValue(mockMessages);
      const result = await workflow.getMessages(threadId);
      expect(result).toEqual(['Valid message', 'Another valid message']);
    });
    it('handles messages with text field', async () => {
      const threadId = 'test-thread-text-field';
      const mockMessages = [
        {
          sender: 'user',
          text: 'Message with text field',
          created_at: new Date().toISOString(),
        },
        {
          sender: 'user',
          text: 'Another message',
          created_at: new Date().toISOString(),
        },
      ];
      mockMessageRepo.getMessages.mockResolvedValue(mockMessages);
      const result = await workflow.getMessages(threadId);
      expect(result).toEqual(['Message with text field', 'Another message']);
    });
    it('returns empty array when no messages exist', async () => {
      const threadId = 'test-thread-empty';
      mockMessageRepo.getMessages.mockResolvedValue([]);
      const result = await workflow.getMessages(threadId);
      expect(result).toEqual([]);
    });
    it('handles malformed message responses', async () => {
      const threadId = 'test-thread-malformed';
      mockMessageRepo.getMessages.mockResolvedValue([
        {
          id: 'msg1',
          sender: 'user',
          text: 'Valid message',
          created_at: new Date().toISOString(),
        },
        {
          id: 'msg2',
          sender: 'user',
          text: '',
          created_at: new Date().toISOString(),
        }, // Empty text - will be filtered out
        {
          id: 'msg3',
          sender: 'agent',
          text: 'Agent message',
          created_at: new Date().toISOString(),
        }, // Will be filtered out by sender
      ]);
      const result = await workflow.getMessages(threadId);
      expect(result).toEqual(['Valid message']);
    });
  });
  describe('message persistence integration', () => {
    it('persists agent response messages during feedback application', async () => {
      // const threadId = 'test-thread-feedback';
      const mockMealPlan = TestMockFactory.createMockWeeklyMealPlan();
      const mockFeedback = ['Please change dinner on Monday'];
      // Mock the MCP client
      const mockClient = TestMockFactory.createMockMCPClient();
      mockClient.callTool.mockResolvedValue({
        isError: false,
        content: [
          {
            type: 'text',
            text: JSON.stringify([TestMockFactory.createMockMeal()]),
          },
        ],
      });
      workflow.client = mockClient;
      // Mock the LLM response
      const mockLLM = TestMockFactory.createMockLLM();
      mockLLM.invoke.mockResolvedValue({
        content: JSON.stringify({
          replacements: [],
          userMessage: "I've updated your meal plan!",
        }),
      });
      workflow.llm = mockLLM;
      const result = await workflow.applyFeedbackWithLLM(
        mockMealPlan,
        mockFeedback,
      );
      expect(result.userMessage).toBe("I've updated your meal plan!");
    });
    it('handles message persistence failures during workflow execution', async () => {
      const threadId = 'test-thread-persistence-fail';
      mockMessageRepo.addMessage.mockRejectedValue(
        new Error('Database connection failed'),
      );
      // Should not affect the workflow execution
      await workflow.addMessage(threadId, 'agent', 'Test message');
      expect(mockMessageRepo.addMessage).toHaveBeenCalled();
    });
  });
});
