import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { fetchRecipes, registerRecipes, type RecipeSummary } from './recipes.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { API } from '../utils.js';
import { createMockServer } from '../utils/createMockServer.js';
import fetchMock from 'jest-fetch-mock';


type MockedResourceHandler = jest.MockedFunction<() => Promise<{ contents: Array<{ uri: string; text: string; mimeType: string }> }>>;

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

      fetchMock.enableMocks();
      fetchMock.mockResponseOnce(JSON.stringify(mockData), { status: 200 });

      const result = await fetchRecipes();

      expect(fetchMock).toHaveBeenCalledWith(`${API}/api/meals`);
      expect(result).toEqual(mockData);
    });

    it('should throw McpError when fetch fails', async () => {
      fetchMock.enableMocks();
      fetchMock.mockResponseOnce('', { status: 404, statusText: 'Not Found' });

      const p = fetchRecipes();
      await expect(p).rejects.toThrow(McpError);
      await expect(p).rejects.toThrow('BackendError: Not Found');
    });

    it('should handle network errors', async () => {
      fetchMock.enableMocks();
      fetchMock.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(fetchRecipes()).rejects.toThrow('Connection refused');
    });

    it('should handle empty recipe list', async () => {
      const mockData: RecipeSummary[] = [];

      fetchMock.enableMocks();
      fetchMock.mockResponseOnce(JSON.stringify(mockData), { status: 200 });

      const result = await fetchRecipes();

      expect(result).toEqual([]);
    });
  });

  describe('registerRecipes', () => {
    it('should register resource with server', () => {
      const mockServer = createMockServer();

      registerRecipes(mockServer);

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

      fetchMock.enableMocks();
      fetchMock.mockResponseOnce(JSON.stringify(mockData), { status: 200 });

      const mockServer = createMockServer();

      registerRecipes(mockServer);

      // Get the handler function that was registered
      const handler = (mockServer as unknown as { resource: { mock: { calls: Array<[string, string, object, MockedResourceHandler]> } } }).resource.mock.calls[0][3];
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
      fetchMock.enableMocks();
      fetchMock.mockResponseOnce('', { status: 503, statusText: 'Service Unavailable' });

      const mockServer = createMockServer();

      registerRecipes(mockServer);

      // Get the handler function that was registered
      const handler = (mockServer as unknown as { resource: { mock: { calls: Array<[string, string, object, MockedResourceHandler]> } } }).resource.mock.calls[0][3];

      const p = handler();
      await expect(p).rejects.toThrow(McpError);
      await expect(p).rejects.toThrow('BackendError: Service Unavailable');
    });

    it('should handle various effort levels', async () => {
      const mockData: RecipeSummary[] = [
        { id: 1, name: 'Salad', redMeat: false, effort: 'LOW' },
        { id: 2, name: 'Chicken Curry', redMeat: false, effort: 'MED' },
        { id: 3, name: 'Beef Wellington', redMeat: true, effort: 'HIGH' }
      ];


      fetchMock.enableMocks();
      fetchMock.mockResponseOnce(JSON.stringify(mockData), { status: 200 });

      const result = await fetchRecipes();

      expect(result).toEqual(mockData);
      expect(result.every(recipe => ['LOW', 'MED', 'HIGH'].includes(recipe.effort))).toBe(true);
    });
  });
});