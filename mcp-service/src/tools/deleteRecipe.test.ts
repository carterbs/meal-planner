import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { deleteRecipe, registerDeleteRecipe, deleteRecipeArgs } from './deleteRecipe.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import fetchMock from 'jest-fetch-mock';
import { createMockServer } from '../utils/createMockServer.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

interface ToolResult {
  content: Array<{ type: string; text: string }>;
}

// Mock the dependencies
jest.mock('../utils.js', () => ({
  API: 'http://test.com'
}));

describe('deleteRecipe tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.enableMocks();
    fetchMock.resetMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('deleteRecipeArgs schema', () => {
    it('should validate valid recipe ID', () => {
      const result = deleteRecipeArgs.parse({ id: 123 });
      expect(result).toEqual({ id: 123 });
    });

    it('should validate positive integers', () => {
      const validIds = [1, 42, 999, 10000];
      validIds.forEach(id => {
        const result = deleteRecipeArgs.parse({ id });
        expect(result).toEqual({ id });
      });
    });

    it('should reject invalid IDs', () => {
      const invalidIds = [
        0,           // not positive
        -1,          // negative
        1.5,         // not integer
        '123',       // string
        null,        // null
        undefined,   // undefined
        {},          // object
        []           // array
      ];

      invalidIds.forEach(id => {
        expect(() => deleteRecipeArgs.parse({ id })).toThrow();
      });
    });

    it('should reject missing ID', () => {
      expect(() => deleteRecipeArgs.parse({})).toThrow();
    });
  });

  describe('deleteRecipe', () => {
    it('should delete recipe successfully', async () => {
      const recipeId = 123;
      const mockResponse = { 
        success: true, 
        message: 'Recipe deleted successfully',
        deletedId: recipeId 
      };

      fetchMock.enableMocks();
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse), { status: 200, statusText: 'OK' });

      const result = await deleteRecipe(recipeId);

      expect(fetchMock).toHaveBeenCalledWith('http://test.com/api/meals/123', {
        method: 'DELETE'
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle different recipe IDs', async () => {
      const testIds = [1, 42, 999, 10000];
      const mockResponse = { success: true };

      fetchMock.enableMocks();
      fetchMock.mockResponse(JSON.stringify(mockResponse), { status: 204, statusText: 'No Content' });

      for (const id of testIds) {
        await deleteRecipe(id);
        expect(fetchMock).toHaveBeenCalledWith(`http://test.com/api/meals/${id}`, {
          method: 'DELETE'
        });
      }
      expect(fetchMock).toHaveBeenCalledTimes(testIds.length);
    });

    it('should throw McpError when recipe not found', async () => {
      const recipeId = 999;

      fetchMock.enableMocks();
      fetchMock.mockResponse(JSON.stringify({}), { status: 404, statusText: 'Not Found' });

      await expect(deleteRecipe(recipeId)).rejects.toThrow(McpError);
      await expect(deleteRecipe(recipeId)).rejects.toThrow('BackendError: Not Found');
    });

    it('should throw McpError when deletion fails', async () => {
      const recipeId = 456;

      fetchMock.enableMocks();
      fetchMock.mockResponse(JSON.stringify({}), { status: 500, statusText: 'Internal Server Error' });

      await expect(deleteRecipe(recipeId)).rejects.toThrow(McpError);
      await expect(deleteRecipe(recipeId)).rejects.toThrow('BackendError: Internal Server Error');
    });

    it('should handle network errors', async () => {
      const recipeId = 789;

      fetchMock.enableMocks();
      fetchMock.mockRejectedValueOnce(new Error('Network connection failed'));

      await expect(deleteRecipe(recipeId)).rejects.toThrow('Network connection failed');
    });

    it('should handle JSON parsing errors', async () => {
      const recipeId = 321;

      fetchMock.enableMocks();
      fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: async () => { throw new Error('Invalid JSON response'); } } as any));

      await expect(deleteRecipe(recipeId)).rejects.toThrow('Invalid JSON response');
    });

    it('should handle empty response body', async () => {
      const recipeId = 654;

      fetchMock.enableMocks();
      fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: true, status: 204, statusText: 'No Content', json: async () => null } as any));

      const result = await deleteRecipe(recipeId);
      expect(result).toBeNull();
    });

    it('should handle forbidden deletion', async () => {
      const recipeId = 555;

      fetchMock.enableMocks();
      fetchMock.mockResponse(JSON.stringify({}), { status: 403, statusText: 'Forbidden' });

      await expect(deleteRecipe(recipeId)).rejects.toThrow(McpError);
      await expect(deleteRecipe(recipeId)).rejects.toThrow('BackendError: Forbidden');
    });
  });

  describe('registerDeleteRecipe', () => {
    it('should register tool with server', () => {
      const mockServer = createMockServer();

      registerDeleteRecipe(mockServer);

      expect(mockServer.registeredTools['deleteRecipe']).toBeDefined();
    });

    it('should return formatted tool response when handler is called', async () => {
      const recipeId = 888;
      const mockResponse = {
        success: true,
        message: 'Recipe successfully deleted',
        deletedId: recipeId,
        timestamp: '2024-01-01T00:00:00Z'
      };

      fetchMock.enableMocks();
      fetchMock.mockResponse(JSON.stringify(mockResponse), { status: 200, statusText: 'OK' });

      const server = createMockServer();
      registerDeleteRecipe(server);

      const handler = server.registeredTools['deleteRecipe'].handler;
      const result = await handler({ id: recipeId });

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(mockResponse, null, 2) }]
      });
    });

    it('should propagate errors from deleteRecipe', async () => {
      const recipeId = 777;

      fetchMock.enableMocks();
      fetchMock.mockResponseOnce('', { status: 409, statusText: 'Conflict' });

      const server = createMockServer();
      registerDeleteRecipe(server);

      const handler = server.registeredTools['deleteRecipe'].handler;

      await expect(handler({ id: recipeId })).rejects.toThrow(McpError);
    });

    it('should handle successful deletion with no content response', async () => {
      const recipeId = 111;

      fetchMock.enableMocks();
      fetchMock.mockResponseOnce(JSON.stringify({}), { status: 204, statusText: 'No Content' });

      const server = createMockServer();
      const mcpServer = server ;
      registerDeleteRecipe(mcpServer);

      const handler = server.registeredTools['deleteRecipe'].handler;
      const result = await handler({ id: recipeId });

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify({}, null, 2) }]
      });
    });

    it('should work with various valid recipe IDs', async () => {
      const testIds = [1, 100, 9999];
      const mockResponse = { deleted: true };

      fetchMock.enableMocks();
      fetchMock.mockResponse(JSON.stringify(mockResponse), { status: 200, statusText: 'OK' });

      const server = createMockServer();
      const mcpServer = server ;
      registerDeleteRecipe(mcpServer);

      const handler = server.registeredTools['deleteRecipe'].handler;

      for (const id of testIds) {
        const result = await handler({ id }) as ToolResult;
        expect(result.content[0].text).toBe(JSON.stringify(mockResponse, null, 2));
      }

      expect(fetchMock).toHaveBeenCalledTimes(testIds.length);
    });

    it('should handle backend errors with detailed messages', async () => {
      const recipeId = 444;

      fetchMock.enableMocks();
      fetchMock.mockResponseOnce('', { status: 422, statusText: 'Unprocessable Entity' });

      const server = createMockServer();
      const mcpServer = server ;
      registerDeleteRecipe(mcpServer);

      const handler = server.registeredTools['deleteRecipe'].handler;

      await expect(handler({ id: recipeId })).rejects.toThrow('BackendError: Unprocessable Entity');

      expect(fetchMock).toHaveBeenCalledWith('http://test.com/api/meals/444', {
        method: 'DELETE'
      });
    });
  });
});