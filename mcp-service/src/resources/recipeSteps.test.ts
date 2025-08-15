import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { fetchRecipeSteps, registerRecipeSteps, type RecipeSteps } from './recipeSteps.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { API } from '../utils.js';

// Mock the utils module
jest.mock('../utils.js', () => ({
  API: 'http://test.com'
}));

describe('recipeSteps resource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fetchRecipeSteps', () => {
    it('should fetch recipe steps successfully', async () => {
      const mockData: RecipeSteps = [
        { order: 1, text: 'Heat oil in pan' },
        { order: 2, text: 'Add ingredients' },
        { order: 3, text: 'Cook for 10 minutes' }
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData
      });

      const result = await fetchRecipeSteps(123);

      expect(global.fetch).toHaveBeenCalledWith(`${API}/api/meals/123/steps`);
      expect(result).toEqual(mockData);
    });

    it('should handle different recipe IDs', async () => {
      const mockData: RecipeSteps = [
        { order: 1, text: 'Preheat oven to 350°F' }
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData
      });

      await fetchRecipeSteps(456);

      expect(global.fetch).toHaveBeenCalledWith(`${API}/api/meals/456/steps`);
    });

    it('should throw McpError when fetch fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: 'Recipe not found'
      });

      await expect(fetchRecipeSteps(999)).rejects.toThrow(McpError);
      await expect(fetchRecipeSteps(999)).rejects.toThrow('BackendError: Recipe not found');
    });

    it('should handle network errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Timeout'));

      await expect(fetchRecipeSteps(123)).rejects.toThrow('Timeout');
    });

    it('should handle empty steps list', async () => {
      const mockData: RecipeSteps = [];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData
      });

      const result = await fetchRecipeSteps(123);

      expect(result).toEqual([]);
    });

    it('should handle steps with various orders', async () => {
      const mockData: RecipeSteps = [
        { order: 5, text: 'Final step' },
        { order: 1, text: 'First step' },
        { order: 3, text: 'Middle step' }
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData
      });

      const result = await fetchRecipeSteps(123);

      expect(result).toEqual(mockData);
      expect(result.every(step => typeof step.order === 'number')).toBe(true);
      expect(result.every(step => typeof step.text === 'string')).toBe(true);
    });
  });

  describe('registerRecipeSteps', () => {
    it('should register resource with server', () => {
      const mockServer = {
        resource: jest.fn()
      };

      registerRecipeSteps(mockServer as any);

      expect(mockServer.resource).toHaveBeenCalledWith(
        'RecipeSteps',
        'meal://recipes/steps',
        {
          description: 'Get the detailed step-by-step cooking instructions for a specific recipe by providing its unique recipe ID. Returns an ordered list of cooking steps with clear instructions.',
          mimeType: 'application/json'
        },
        expect.any(Function)
      );
    });

    it('should return empty steps data when handler is called', async () => {
      const mockServer = {
        resource: jest.fn()
      };

      registerRecipeSteps(mockServer as any);

      // Get the handler function that was registered
      const handler = (mockServer.resource as jest.MockedFunction<any>).mock.calls[0][3];
      const result = await handler();

      expect(result).toEqual({
        contents: [{
          uri: 'meal://recipes/steps',
          text: JSON.stringify([], null, 2),
          mimeType: 'application/json'
        }]
      });
    });

    it('should not make any API calls in the resource handler', async () => {
      global.fetch = jest.fn();

      const mockServer = {
        resource: jest.fn()
      };

      registerRecipeSteps(mockServer as any);

      // Get the handler function that was registered
      const handler = (mockServer.resource as jest.MockedFunction<any>).mock.calls[0][3];
      await handler();

      // The current implementation doesn't fetch data in the resource handler
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return consistent format regardless of input', async () => {
      const mockServer = {
        resource: jest.fn()
      };

      registerRecipeSteps(mockServer as any);

      // Get the handler function that was registered
      const handler = (mockServer.resource as jest.MockedFunction<any>).mock.calls[0][3];
      
      // Call multiple times to ensure consistency
      const result1 = await handler();
      const result2 = await handler();

      expect(result1).toEqual(result2);
      expect(result1.contents[0].uri).toBe('meal://recipes/steps');
      expect(result1.contents[0].mimeType).toBe('application/json');
    });
  });
});