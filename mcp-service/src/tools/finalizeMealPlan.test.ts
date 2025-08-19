import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { finalizePlan, registerFinalizeMealPlan, finalzeArgs } from './finalizeMealPlan.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import fetchMock from 'jest-fetch-mock';
import { createMockServer } from '../utils/createMockServer.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Mock the dependencies
jest.mock('../utils.js', () => ({
  API: 'http://test.com'
}));

jest.mock('@mealplanner/generated', () => ({
  FinalizeMealPlanResponse: {
    fromJson: jest.fn().mockImplementation((data) => data)
  }
}));
fetchMock.enableMocks();

// Use shared typed mock server from `createMockServer` which implements the minimal
// McpServer surface we need and exposes `callTool` for tests.

describe('finalizeMealPlan tool', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = jest.fn();
    console.error = jest.fn();
    fetchMock.resetMocks();
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

      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

      const result = await finalizePlan(threadId);

      expect(fetchMock).toHaveBeenCalledWith('http://test.com/api/mealplan/finalize', {
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

      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

      await finalizePlan(threadId);

      expect(console.log).toHaveBeenCalledWith(`🔧 [MCP-FINALIZE] Sending POST to http://test.com/api/mealplan/finalize`);
      expect(console.log).toHaveBeenCalledWith(`🔧 [MCP-FINALIZE] Request body:`, JSON.stringify({ thread_id: threadId }, null, 2));
      expect(console.log).toHaveBeenCalledWith(`🔧 [MCP-FINALIZE] Response status: 200 OK`);
    });

    it('should throw McpError when response is not ok', async () => {
      const threadId = 'thread-789';

      fetchMock.mockResponseOnce(JSON.stringify({ message: 'Thread not found' }), { status: 404 });

      await finalizePlan(threadId).catch((err) => {
        expect(err).toBeInstanceOf(McpError);
        expect(err.message).toContain('BackendError: Not Found');
      });

      expect(console.error).toHaveBeenCalledWith(`🔧 [MCP-FINALIZE] Error response body: ${JSON.stringify({ message: 'Thread not found' })}`);
    });

    it('should handle network errors', async () => {
      const threadId = 'thread-error';

      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await expect(finalizePlan(threadId)).rejects.toThrow('Network error');
    });

    it('should handle JSON parsing errors', async () => {
      const threadId = 'thread-invalid';

      fetchMock.mockResponseOnce(JSON.stringify({ message: 'Invalid JSON' }), { status: 200 });

      const { FinalizeMealPlanResponse } = await import('@mealplanner/generated');
      (FinalizeMealPlanResponse.fromJson as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Invalid JSON');
      });

      await expect(finalizePlan(threadId)).rejects.toThrow('Invalid JSON');
    });

    it('should call FinalizeMealPlanResponse.fromJson with response', async () => {
      const threadId = 'thread-123';
      const mockResponse = { message: 'Success', data: 'test' };

      const { FinalizeMealPlanResponse } = await import('@mealplanner/generated');

      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

      await finalizePlan(threadId);

      const fromJsonMock = FinalizeMealPlanResponse.fromJson as unknown as jest.Mock;
      expect(fromJsonMock).toHaveBeenCalledWith(mockResponse);
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
      const server = createMockServer();
      const mcpServer = server as unknown as McpServer;

      registerFinalizeMealPlan(mcpServer);

      const entry = server.registeredTools!['finalizeMealPlan'];
      expect(entry).toBeDefined();
      expect(entry.description).toEqual('Finalize the meal plan for the given thread ID.');
      expect(entry.schema).toEqual({ threadId: finalzeArgs.shape.threadId });
      expect(typeof entry.handler).toBe('function');
    });

    it('should handle valid threadId in tool handler', async () => {
      const threadId = 'thread-123';
      const mockResponse = { message: 'Finalized' };

      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

      const server = createMockServer();
      const mcpServer = server as unknown as McpServer;
      registerFinalizeMealPlan(mcpServer);

      const handler = server.registeredTools!['finalizeMealPlan'].handler;
      const result = await handler({ threadId });

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(mockResponse) }]
      });

      expect(console.log).toHaveBeenCalledWith(`🔧 [MCP-FINALIZE] Tool called with args:`, JSON.stringify(threadId, null, 2));
      expect(console.log).toHaveBeenCalledWith(`🔧 [MCP-FINALIZE] Processing thread ID: ${threadId}`);
    });

    it('should throw McpError for empty threadId', async () => {
      const server = createMockServer();
      const mcpServer = server as unknown as McpServer;
      registerFinalizeMealPlan(mcpServer);

      const handler = server.registeredTools!['finalizeMealPlan'].handler;
      await expect(handler({ threadId: '' })).rejects.toThrow(McpError);
      await expect(handler({ threadId: '' })).rejects.toThrow('threadId is required and must be a non-empty string');
    });

    it('should throw McpError for null threadId', async () => {
      const server = createMockServer();
      const mcpServer = server as unknown as McpServer;
      registerFinalizeMealPlan(mcpServer);

      const handler = server.registeredTools!['finalizeMealPlan'].handler;
      await expect(handler({ threadId: null })).rejects.toThrow(McpError);
      await expect(handler({ threadId: undefined })).rejects.toThrow(McpError);
    });

    it('should throw McpError for non-string threadId', async () => {
      const server = createMockServer();
      const mcpServer = server as unknown as McpServer;
      registerFinalizeMealPlan(mcpServer);

      const handler = server.registeredTools!['finalizeMealPlan'].handler;
      await expect(handler({ threadId: 123 })).rejects.toThrow(McpError);
      await expect(handler({ threadId: {} })).rejects.toThrow(McpError);
    });

    it('should handle whitespace-only threadId', async () => {
      const server = createMockServer();
      const mcpServer = server as unknown as McpServer;
      registerFinalizeMealPlan(mcpServer);

      const handler = server.registeredTools!['finalizeMealPlan'].handler;
      await expect(handler({ threadId: '   ' })).rejects.toThrow(McpError);
      await expect(handler({ threadId: '\t\n' })).rejects.toThrow(McpError);
    });

    it('should log argument debugging information', async () => {
      const threadId = 'thread-debug';
      const mockResponse = { message: 'Debug success' };

      fetchMock.mockResponseOnce(JSON.stringify(mockResponse), { status: 200, statusText: 'OK' });

      const server = createMockServer();
      const mcpServer = server as unknown as McpServer;
      registerFinalizeMealPlan(mcpServer);

      const handler = server.registeredTools!['finalizeMealPlan'].handler;
      await handler({ threadId });

      expect(console.log).toHaveBeenCalledWith(`🔧 [MCP-FINALIZE] Args type:`, 'string');
      expect(console.log).toHaveBeenCalledWith(`🔧 [MCP-FINALIZE] Available keys in args:`, 'not an object');
      expect(console.log).toHaveBeenCalledWith(`🔧 [MCP-FINALIZE] Tool returning result:`, mockResponse);
    });

    it('should propagate errors from finalizePlan', async () => {
      const threadId = 'thread-error';

      fetchMock.mockResponseOnce(JSON.stringify({ message: 'Server error' }), { status: 500 });

      const server = createMockServer();
      const mcpServer = server as unknown as McpServer;
      registerFinalizeMealPlan(mcpServer);

      const handler = server.registeredTools!['finalizeMealPlan'].handler;
      await expect(handler({ threadId })).rejects.toThrow();
    });
  });
});