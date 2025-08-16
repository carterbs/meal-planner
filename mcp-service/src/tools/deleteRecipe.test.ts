import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { deleteRecipe, registerDeleteRecipe, deleteRecipeArgs } from './deleteRecipe.js';
import { McpError, McpServer } from '@modelcontextprotocol/sdk/types.js';

// Mock the dependencies
jest.mock('../utils.js', () => ({
  API: 'http://test.com'
}));

describe('deleteRecipe tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse
      });

      const result = await deleteRecipe(recipeId);

      expect(global.fetch).toHaveBeenCalledWith('http://test.com/api/meals/123', {
        method: 'DELETE'
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle different recipe IDs', async () => {
      const testIds = [1, 42, 999, 10000];
      const mockResponse = { success: true };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 204, // No Content
        statusText: 'No Content',
        json: async () => mockResponse
      });

      for (const id of testIds) {
        await deleteRecipe(id);
        expect(global.fetch).toHaveBeenCalledWith(`http://test.com/api/meals/${id}`, {
          method: 'DELETE'
        });
      }

      expect(global.fetch).toHaveBeenCalledTimes(testIds.length);
    });

    it('should throw McpError when recipe not found', async () => {
      const recipeId = 999;

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(deleteRecipe(recipeId)).rejects.toThrow(McpError);
      await expect(deleteRecipe(recipeId)).rejects.toThrow('BackendError: Not Found');
    });

    it('should throw McpError when deletion fails', async () => {
      const recipeId = 456;

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(deleteRecipe(recipeId)).rejects.toThrow(McpError);
      await expect(deleteRecipe(recipeId)).rejects.toThrow('BackendError: Internal Server Error');
    });

    it('should handle network errors', async () => {
      const recipeId = 789;

      global.fetch = jest.fn().mockRejectedValue(new Error('Network connection failed'));

      await expect(deleteRecipe(recipeId)).rejects.toThrow('Network connection failed');
    });

    it('should handle JSON parsing errors', async () => {
      const recipeId = 321;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => { throw new Error('Invalid JSON response'); }
      });

      await expect(deleteRecipe(recipeId)).rejects.toThrow('Invalid JSON response');
    });

    it('should handle empty response body', async () => {
      const recipeId = 654;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 204, // No Content
        statusText: 'No Content',
        json: async () => null
      });

      const result = await deleteRecipe(recipeId);
      expect(result).toBeNull();
    });

    it('should handle forbidden deletion', async () => {
      const recipeId = 555;

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      });

      await expect(deleteRecipe(recipeId)).rejects.toThrow(McpError);
      await expect(deleteRecipe(recipeId)).rejects.toThrow('BackendError: Forbidden');
    });
  });

  describe('registerDeleteRecipe', () => {
    it('should register tool with server', () => {
      const mockServer = {
        tool: jest.fn()
      };

      registerDeleteRecipe(mockServer);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'deleteRecipe',
        'Permanently delete a recipe from the database by its unique ID. This action cannot be undone and will remove the recipe from all future meal planning. Use with caution.',
        {
          id: deleteRecipeArgs.shape.id
        },
        expect.any(Function)
      );
    });

    it('should return formatted tool response when handler is called', async () => {
      const recipeId = 888;
      const mockResponse = {
        success: true,
        message: 'Recipe successfully deleted',
        deletedId: recipeId,
        timestamp: '2024-01-01T00:00:00Z'
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse
      });

      const mockServer = {
        tool: jest.fn()
      };

      registerDeleteRecipe(mockServer);

      // Get the handler function that was registered
      const handler = (mockServer.tool as jest.MockedFunction<typeof handler>).mock.calls[0][3];
      const result = await handler({ id: recipeId });

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(mockResponse, null, 2) }]
      });
    });

    it('should propagate errors from deleteRecipe', async () => {
      const recipeId = 777;

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 409,
        statusText: 'Conflict'
      });

      const mockServer = {
        tool: jest.fn()
      };

      registerDeleteRecipe(mockServer);

      // Get the handler function that was registered
      const handler = (mockServer.tool as jest.MockedFunction<typeof handler>).mock.calls[0][3];

      await expect(handler({ id: recipeId })).rejects.toThrow(McpError);
      await expect(handler({ id: recipeId })).rejects.toThrow('BackendError: Conflict');
    });

    it('should handle successful deletion with no content response', async () => {
      const recipeId = 111;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 204,
        statusText: 'No Content',
        json: async () => ({})
      });

      const mockServer = {
        tool: jest.fn()
      };

      registerDeleteRecipe(mockServer);

      // Get the handler function that was registered
      const handler = (mockServer.tool as jest.MockedFunction<typeof handler>).mock.calls[0][3];
      const result = await handler({ id: recipeId });

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify({}, null, 2) }]
      });
    });

    it('should work with various valid recipe IDs', async () => {
      const testIds = [1, 100, 9999];
      const mockResponse = { deleted: true };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse
      });

      const mockServer = {
        tool: jest.fn()
      };

      registerDeleteRecipe(mockServer);

      // Get the handler function that was registered
      const handler = (mockServer.tool as jest.MockedFunction<typeof handler>).mock.calls[0][3];

      for (const id of testIds) {
        const result = await handler({ id });
        expect(result.content[0].text).toBe(JSON.stringify(mockResponse, null, 2));
      }

      expect(global.fetch).toHaveBeenCalledTimes(testIds.length);
    });

    it('should handle backend errors with detailed messages', async () => {
      const recipeId = 444;

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity'
      });

      const mockServer = {
        tool: jest.fn()
      };

      registerDeleteRecipe(mockServer);

      // Get the handler function that was registered
      const handler = (mockServer.tool as jest.MockedFunction<typeof handler>).mock.calls[0][3];

      await expect(handler({ id: recipeId })).rejects.toThrow('BackendError: Unprocessable Entity');
      
      expect(global.fetch).toHaveBeenCalledWith('http://test.com/api/meals/444', {
        method: 'DELETE'
      });
    });
  });
});