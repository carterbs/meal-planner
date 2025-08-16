import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { finalizePlan, registerFinalizeMealPlan, finalzeArgs } from './finalizeMealPlan.js';
import { McpError, McpServer } from '@modelcontextprotocol/sdk/types.js';
import type { FinalizeMealPlanResponse } from '@mealplanner/generated';

// Mock the dependencies
jest.mock('../utils.js', () => ({
  API: 'http://test.com'
}));

jest.mock('@mealplanner/generated', () => ({
  FinalizeMealPlanResponse: {
    fromJson: jest.fn().mockImplementation((data) => data)
  }
}));

describe('finalizeMealPlan tool', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = jest.fn();
    console.error = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    jest.restoreAllMocks();
  });

  describe('finalizePlan', () => {
    it('should finalize meal plan successfully', async () => {
      const threadId = 'thread-123';
      const mockResponse = { message: 'Plan finalized successfully', threadId };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse
      });

      const result = await finalizePlan(threadId);

      expect(global.fetch).toHaveBeenCalledWith('http://test.com/api/mealplan/finalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ thread_id: threadId })
      });

      expect(result).toEqual(mockResponse);
      expect(console.log).toHaveBeenCalledWith(`🔧 [MCP-FINALIZE] Starting finalization for thread ID: ${threadId}`);
      expect(console.log).toHaveBeenCalledWith(`🔧 [MCP-FINALIZE] Success response:`, mockResponse);
    });

    it('should log request details', async () => {
      const threadId = 'thread-456';
      const mockResponse = { message: 'Success' };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse
      });

      await finalizePlan(threadId);

      expect(console.log).toHaveBeenCalledWith(`🔧 [MCP-FINALIZE] Sending POST to http://test.com/api/mealplan/finalize`);
      expect(console.log).toHaveBeenCalledWith(`🔧 [MCP-FINALIZE] Request body:`, JSON.stringify({ thread_id: threadId }, null, 2));
      expect(console.log).toHaveBeenCalledWith(`🔧 [MCP-FINALIZE] Response status: 200 OK`);
    });

    it('should throw McpError when response is not ok', async () => {
      const threadId = 'thread-789';

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Thread not found'
      });

      await expect(finalizePlan(threadId)).rejects.toThrow(McpError);
      await expect(finalizePlan(threadId)).rejects.toThrow('BackendError: Not Found');

      expect(console.error).toHaveBeenCalledWith('🔧 [MCP-FINALIZE] Error response body: Thread not found');
    });

    it('should handle network errors', async () => {
      const threadId = 'thread-error';

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(finalizePlan(threadId)).rejects.toThrow('Network error');
    });

    it('should handle JSON parsing errors', async () => {
      const threadId = 'thread-invalid';

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => { throw new Error('Invalid JSON'); }
      });

      await expect(finalizePlan(threadId)).rejects.toThrow('Invalid JSON');
    });

    it('should call FinalizeMealPlanResponse.fromJson with response', async () => {
      const threadId = 'thread-123';
      const mockResponse = { message: 'Success', data: 'test' };

      const { FinalizeMealPlanResponse } = await import('@mealplanner/generated');

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse
      });

      await finalizePlan(threadId);

      expect(FinalizeMealPlanResponse.fromJson).toHaveBeenCalledWith(mockResponse);
    });
  });

  describe('finalzeArgs schema', () => {
    it('should validate valid threadId', () => {
      const result = finalzeArgs.parse({ threadId: 'valid-thread-id' });
      expect(result).toEqual({ threadId: 'valid-thread-id' });
    });

    it('should reject invalid data', () => {
      expect(() => finalzeArgs.parse({ threadId: 123 })).toThrow();
      expect(() => finalzeArgs.parse({})).toThrow();
      expect(() => finalzeArgs.parse({ threadId: null })).toThrow();
    });
  });

  describe('registerFinalizeMealPlan', () => {
    it('should register tool with server', () => {
      const mockServer = {
        tool: jest.fn()
      };

      registerFinalizeMealPlan(mockServer);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'finalizeMealPlan',
        'Finalize the meal plan for the given thread ID.',
        {
          threadId: finalzeArgs.shape.threadId
        },
        expect.any(Function)
      );
    });

    it('should handle valid threadId in tool handler', async () => {
      const threadId = 'thread-123';
      const mockResponse = { message: 'Finalized' };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse
      });

      const mockServer = {
        tool: jest.fn()
      };

      registerFinalizeMealPlan(mockServer);

      // Get the handler function that was registered
      const handler = (mockServer.tool as jest.MockedFunction<typeof handler>).mock.calls[0][3];
      const result = await handler({ threadId });

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(mockResponse) }]
      });

      expect(console.log).toHaveBeenCalledWith(`🔧 [MCP-FINALIZE] Tool called with args:`, JSON.stringify(threadId, null, 2));
      expect(console.log).toHaveBeenCalledWith(`🔧 [MCP-FINALIZE] Processing thread ID: ${threadId}`);
    });

    it('should throw McpError for empty threadId', async () => {
      const mockServer = {
        tool: jest.fn()
      };

      registerFinalizeMealPlan(mockServer);

      // Get the handler function that was registered
      const handler = (mockServer.tool as jest.MockedFunction<typeof handler>).mock.calls[0][3];

      await expect(handler({ threadId: '' })).rejects.toThrow(McpError);
      await expect(handler({ threadId: '' })).rejects.toThrow('threadId is required and must be a non-empty string');
    });

    it('should throw McpError for null threadId', async () => {
      const mockServer = {
        tool: jest.fn()
      };

      registerFinalizeMealPlan(mockServer);

      // Get the handler function that was registered
      const handler = (mockServer.tool as jest.MockedFunction<typeof handler>).mock.calls[0][3];

      await expect(handler({ threadId: null })).rejects.toThrow(McpError);
      await expect(handler({ threadId: undefined })).rejects.toThrow(McpError);
    });

    it('should throw McpError for non-string threadId', async () => {
      const mockServer = {
        tool: jest.fn()
      };

      registerFinalizeMealPlan(mockServer);

      // Get the handler function that was registered
      const handler = (mockServer.tool as jest.MockedFunction<typeof handler>).mock.calls[0][3];

      await expect(handler({ threadId: 123 })).rejects.toThrow(McpError);
      await expect(handler({ threadId: {} })).rejects.toThrow(McpError);
    });

    it('should handle whitespace-only threadId', async () => {
      const mockServer = {
        tool: jest.fn()
      };

      registerFinalizeMealPlan(mockServer);

      // Get the handler function that was registered
      const handler = (mockServer.tool as jest.MockedFunction<typeof handler>).mock.calls[0][3];

      await expect(handler({ threadId: '   ' })).rejects.toThrow(McpError);
      await expect(handler({ threadId: '\t\n' })).rejects.toThrow(McpError);
    });

    it('should log argument debugging information', async () => {
      const threadId = 'thread-debug';
      const mockResponse = { message: 'Debug success' };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse
      });

      const mockServer = {
        tool: jest.fn()
      };

      registerFinalizeMealPlan(mockServer);

      // Get the handler function that was registered
      const handler = (mockServer.tool as jest.MockedFunction<typeof handler>).mock.calls[0][3];
      await handler({ threadId });

      expect(console.log).toHaveBeenCalledWith(`🔧 [MCP-FINALIZE] Args type:`, 'string');
      expect(console.log).toHaveBeenCalledWith(`🔧 [MCP-FINALIZE] Available keys in args:`, 'not an object');
      expect(console.log).toHaveBeenCalledWith(`🔧 [MCP-FINALIZE] Tool returning result:`, mockResponse);
    });

    it('should propagate errors from finalizePlan', async () => {
      const threadId = 'thread-error';

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error'
      });

      const mockServer = {
        tool: jest.fn()
      };

      registerFinalizeMealPlan(mockServer);

      // Get the handler function that was registered
      const handler = (mockServer.tool as jest.MockedFunction<typeof handler>).mock.calls[0][3];

      await expect(handler({ threadId })).rejects.toThrow(McpError);
      await expect(handler({ threadId })).rejects.toThrow('BackendError: Internal Server Error');
    });
  });
});