import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { fetchRecipes, registerRecipes, type RecipeSummary } from './recipes.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { API } from '../utils.js';

// Mock the utils module
jest.mock('../utils.js', () => ({
  API: 'http://test.com'
}));

describe('recipes resource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fetchRecipes', () => {
    it('should fetch recipes successfully', async () => {
      const mockData: RecipeSummary[] = [
        { id: 1, name: 'Pasta', redMeat: false, effort: 'LOW' },
        { id: 2, name: 'Steak', redMeat: true, effort: 'HIGH' }
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData
      });

      const result = await fetchRecipes();

      expect(global.fetch).toHaveBeenCalledWith(`${API}/api/meals`);
      expect(result).toEqual(mockData);
    });

    it('should throw McpError when fetch fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: 'Not Found'
      });

      await expect(fetchRecipes()).rejects.toThrow(McpError);
      await expect(fetchRecipes()).rejects.toThrow('BackendError: Not Found');
    });

    it('should handle network errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));

      await expect(fetchRecipes()).rejects.toThrow('Connection refused');
    });

    it('should handle empty recipe list', async () => {
      const mockData: RecipeSummary[] = [];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData
      });

      const result = await fetchRecipes();

      expect(result).toEqual([]);
    });
  });

  describe('registerRecipes', () => {
    it('should register resource with server', () => {
      const mockServer = {
        resource: jest.fn()
      };

      registerRecipes(mockServer as any);

      expect(mockServer.resource).toHaveBeenCalledWith(
        'Recipes',
        'meal://recipes/all',
        {
          description: 'Get a comprehensive list of all available recipes with their basic information including unique ID, name, effort level (LOW/MED/HIGH), and whether they contain red meat',
          mimeType: 'application/json'
        },
        expect.any(Function)
      );
    });

    it('should return formatted resource data when handler is called', async () => {
      const mockData: RecipeSummary[] = [
        { id: 1, name: 'Pasta', redMeat: false, effort: 'LOW' },
        { id: 2, name: 'Burger', redMeat: true, effort: 'MED' }
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData
      });

      const mockServer = {
        resource: jest.fn()
      };

      registerRecipes(mockServer as any);

      // Get the handler function that was registered
      const handler = (mockServer.resource as jest.MockedFunction<any>).mock.calls[0][3];
      const result = await handler();

      expect(result).toEqual({
        contents: [{
          uri: 'meal://recipes/all',
          text: JSON.stringify(mockData, null, 2),
          mimeType: 'application/json'
        }]
      });
    });

    it('should propagate errors from fetchRecipes', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: 'Service Unavailable'
      });

      const mockServer = {
        resource: jest.fn()
      };

      registerRecipes(mockServer as any);

      // Get the handler function that was registered
      const handler = (mockServer.resource as jest.MockedFunction<any>).mock.calls[0][3];

      await expect(handler()).rejects.toThrow(McpError);
      await expect(handler()).rejects.toThrow('BackendError: Service Unavailable');
    });

    it('should handle various effort levels', async () => {
      const mockData: RecipeSummary[] = [
        { id: 1, name: 'Salad', redMeat: false, effort: 'LOW' },
        { id: 2, name: 'Chicken Curry', redMeat: false, effort: 'MED' },
        { id: 3, name: 'Beef Wellington', redMeat: true, effort: 'HIGH' }
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData
      });

      const result = await fetchRecipes();

      expect(result).toEqual(mockData);
      expect(result.every(recipe => ['LOW', 'MED', 'HIGH'].includes(recipe.effort))).toBe(true);
    });
  });
});