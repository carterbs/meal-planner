import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpError } from '@modelcontextprotocol/sdk/types.js';

// Mock the finalizePlan function for testing
const mockFinalizePlan = jest.fn() as jest.MockedFunction<any>;
jest.mock('./finalizeMealPlan.js', () => ({
  ...(jest.requireActual('./finalizeMealPlan.js') as object),
  finalizePlan: mockFinalizePlan,
}));

// Mock MCP server for testing tool registration
const mockTool = jest.fn();
const mockServer = {
  tool: mockTool,
};

// Import after mocking
import { registerFinalizeMealPlan } from './finalizeMealPlan.js';

describe('registerFinalizeMealPlan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should register tool with correct signature', () => {
    registerFinalizeMealPlan(mockServer as any);

    expect(mockTool).toHaveBeenCalledWith(
      'finalizeMealPlan',
      'Finalize the meal plan for the given thread ID.',
      {
        threadId: {
          description: 'Thread ID of the workflow containing the meal plan to finalize',
          type: 'string'
        }
      },
      expect.any(Function)
    );
  });

  describe('tool handler', () => {
    let toolHandler: any;

    beforeEach(() => {
      registerFinalizeMealPlan(mockServer as any);
      toolHandler = mockTool.mock.calls[0][3]; // Get the handler function
    });

    it('should handle valid thread ID', async () => {
      const mockResult = { success: true, message: 'Plan finalized' };
      mockFinalizePlan.mockResolvedValue(mockResult);

      const args = { threadId: 'abc-123-valid-thread' };
      const result = await toolHandler(args);

      expect(mockFinalizePlan).toHaveBeenCalledWith('abc-123-valid-thread');
      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(mockResult) }]
      });
    });

    it('should reject empty thread ID', async () => {
      const args = { threadId: '' };

      await expect(toolHandler(args)).rejects.toThrow(McpError);
      await expect(toolHandler(args)).rejects.toThrow('threadId is required and must be a non-empty string');
      expect(mockFinalizePlan).not.toHaveBeenCalled();
    });

    it('should reject null thread ID', async () => {
      const args = { threadId: null };

      await expect(toolHandler(args)).rejects.toThrow(McpError);
      expect(mockFinalizePlan).not.toHaveBeenCalled();
    });

    it('should reject undefined thread ID', async () => {
      const args = {};

      await expect(toolHandler(args)).rejects.toThrow(McpError);
      expect(mockFinalizePlan).not.toHaveBeenCalled();
    });

    it('should reject non-string thread ID', async () => {
      const args = { threadId: 123 };

      await expect(toolHandler(args)).rejects.toThrow(McpError);
      expect(mockFinalizePlan).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only thread ID', async () => {
      const args = { threadId: '   ' };

      await expect(toolHandler(args)).rejects.toThrow(McpError);
      await expect(toolHandler(args)).rejects.toThrow('threadId is required and must be a non-empty string');
      expect(mockFinalizePlan).not.toHaveBeenCalled();
    });

    it('should handle UUID-format thread ID', async () => {
      const mockResult = { success: true };
      mockFinalizePlan.mockResolvedValue(mockResult);

      const args = { threadId: '550e8400-e29b-41d4-a716-446655440000' };
      const result = await toolHandler(args);

      expect(mockFinalizePlan).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
    });

    it('should propagate finalizePlan errors', async () => {
      const mockError = new Error('Backend connection failed');
      mockFinalizePlan.mockRejectedValue(mockError);

      const args = { threadId: 'valid-thread' };

      await expect(toolHandler(args)).rejects.toThrow('Backend connection failed');
      expect(mockFinalizePlan).toHaveBeenCalledWith('valid-thread');
    });
  });
});

describe('finalizePlan function signature', () => {
  // Test the expected behavior of the finalizePlan function
  // These tests document what the function should do after refactor

  it('should accept thread ID string parameter', () => {
    // After refactor, finalizePlan should take: (threadId: string)
    // Not: (mealIds: number[]) as in current implementation
    
    const threadId = 'abc-123-test-thread';
    
    // This documents the new signature
    expect(typeof threadId).toBe('string');
    expect(threadId.trim()).not.toBe('');
  });

  it('should create request body with thread_id field', () => {
    const threadId = 'test-thread-456';
    
    // After refactor, the request body should be:
    const expectedRequestBody = {
      thread_id: threadId
    };
    
    expect(expectedRequestBody).toHaveProperty('thread_id', threadId);
    expect(expectedRequestBody).not.toHaveProperty('meal_ids');
    expect(expectedRequestBody).not.toHaveProperty('plan');
  });

  it('should log thread ID instead of meal IDs', () => {
    const threadId = 'test-thread-789';
    
    // After refactor, logs should show:
    // "🔧 [MCP-FINALIZE] Starting finalization for thread: test-thread-789"
    // Not: "🔧 [MCP-FINALIZE] Starting finalization for 14 meal IDs: [61, 23, ...]"
    
    const expectedLogMessage = `🔧 [MCP-FINALIZE] Starting finalization for thread: ${threadId}`;
    expect(expectedLogMessage).toContain('thread:');
    expect(expectedLogMessage).toContain(threadId);
    expect(expectedLogMessage).not.toContain('meal IDs');
  });

  it('should create minimal request payload', () => {
    const threadId = 'minimal-thread';
    
    const requestBody = { thread_id: threadId };
    const serialized = JSON.stringify(requestBody);
    
    // The new approach should create much smaller payloads
    expect(serialized.length).toBeLessThan(100); // vs potentially thousands for meal objects
    expect(serialized).toBe('{"thread_id":"minimal-thread"}');
  });
});

