import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { fetchRecipeSteps, RecipeSteps, registerRecipeSteps } from './recipeSteps.js';
// avoid TypeScript-specific `type` declarations at top-level for runtime
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { API } from '../utils.js';
import { createMockServer } from '../utils/createMockServer.js';
import fetchMock from 'jest-fetch-mock';
import { Step } from '@mealplanner/generated';


// Define proper types for mocked resource handler and result
interface ResourceContent {
  uri: string;
  mimeType: string;
  text?: string;
}

interface ResourceResult {
  contents: ResourceContent[];
}

type MockedResourceHandler = jest.MockedFunction<(uri: string) => Promise<ResourceResult>>;

// Mock the utils module
jest.mock('../utils.js', () => ({
  API: 'http://test.com'
}));

describe('recipeSteps resource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.enableMocks();
    fetchMock.resetMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fetchRecipeSteps', () => {
    it('should fetch recipe steps successfully', async () => {
      const mockData = [
        { order: 1, text: 'Heat oil in pan' },
        { order: 2, text: 'Add ingredients' },
        { order: 3, text: 'Cook for 10 minutes' }
      ];

      fetchMock.mockResponseOnce(JSON.stringify(mockData), { status: 200 });
      const result = await fetchRecipeSteps(123);

      expect(fetchMock).toHaveBeenCalledWith(`${API}/api/meals/123/steps`);
      expect(result).toEqual(mockData);
    });

    it('should handle different recipe IDs', async () => {
      const mockData = [ { order: 1, text: 'Preheat oven to 350°F' } ];
      fetchMock.mockResponseOnce(JSON.stringify(mockData), { status: 200 });

      await fetchRecipeSteps(456);

      expect(fetchMock).toHaveBeenCalledWith(`${API}/api/meals/456/steps`);
    });

    it('should throw McpError when fetch fails', async () => {
      fetchMock.mockResponseOnce('', { status: 404, statusText: 'Recipe not found' });

      await expect(fetchRecipeSteps(999)).rejects.toThrow(McpError);
    });

    it('should handle network errors', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Timeout'));

      await expect(fetchRecipeSteps(123)).rejects.toThrow('Timeout');
    });

    it('should handle empty steps list', async () => {
      const mockData: RecipeSteps = [];
      fetchMock.mockResponseOnce(JSON.stringify(mockData), { status: 200 });
      const result = await fetchRecipeSteps(123);

      expect(result).toEqual([]);
    });

    it('should handle steps with various orders', async () => {
      const mockData: Partial<Step>[] = [
        { mealId: 5, instruction: 'Final step' },
        { mealId: 1, instruction: 'First step' },
        { mealId: 3, instruction: 'Middle step' }
      ];

      fetchMock.mockResponseOnce(JSON.stringify(mockData), { status: 200 });
      const result = await fetchRecipeSteps(123);

      expect(result).toEqual(mockData);
      expect(result.every((step) => typeof step.mealId === 'number')).toBe(true);
      expect(result.every((step) => typeof step.instruction === 'string')).toBe(true);
    });
  });

  describe('registerRecipeSteps', () => {
    it('should register resource with server', () => {
      const mockServer = createMockServer();

      registerRecipeSteps(mockServer);

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
      const mockServer = createMockServer();

      registerRecipeSteps(mockServer);

      // Get the handler function that was registered
      const handler = (mockServer as unknown as { resource: { mock: { calls: Array<[string, string, object, MockedResourceHandler]> } } }).resource.mock.calls[0][3];
      const result = await handler('test-uri');

      expect(result).toEqual({
        contents: [{
          uri: 'meal://recipes/steps',
          text: JSON.stringify([], null, 2),
          mimeType: 'application/json'
        }]
      });
    });

    it('should not make any API calls in the resource handler', async () => {
      fetchMock.resetMocks();

      const mockServer = createMockServer();

      registerRecipeSteps(mockServer);

      // Get the handler function that was registered
      const handler = (mockServer as unknown as { resource: { mock: { calls: Array<[string, string, object, MockedResourceHandler]> } } }).resource.mock.calls[0][3];
      await handler('test-uri');

      // The current implementation doesn't fetch data in the resource handler
      expect(fetchMock.mock.calls.length).toBe(0);
    });

    it('should return consistent format regardless of input', async () => {
      const mockServer = createMockServer();

      registerRecipeSteps(mockServer);

      // Get the handler function that was registered
      const handler = (mockServer as unknown as { resource: { mock: { calls: Array<[string, string, object, MockedResourceHandler]> } } }).resource.mock.calls[0][3];
      
      // Call multiple times to ensure consistency
      const result1 = await handler('test-uri');
      const result2 = await handler('test-uri');

      expect(result1).toEqual(result2);
      expect(result1.contents[0].uri).toBe('meal://recipes/steps');
      expect(result1.contents[0].mimeType).toBe('application/json');
    });
  });
});