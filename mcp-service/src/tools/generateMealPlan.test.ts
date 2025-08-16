import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { generateMealPlan, registerGenerateMealPlan } from './generateMealPlan.js';
import { McpError, McpServer } from '@modelcontextprotocol/sdk/types.js';
import type { GenerateMealPlanResponse } from '@mealplanner/generated';

// Mock the dependencies
jest.mock('../logging.js', () => ({
  debugLog: jest.fn().mockResolvedValue(undefined),
  infoLog: jest.fn().mockResolvedValue(undefined),
  warnLog: jest.fn().mockResolvedValue(undefined),
  errorLog: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../utils.js', () => ({
  API: 'http://test.com',
  retryFetch: jest.fn()
}));

describe('generateMealPlan tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateMealPlan', () => {
    it('should generate meal plan successfully', async () => {
      const mockResponse: GenerateMealPlanResponse = {
        plan: {
          days: [
            { dayIndex: 0, mealType: 'dinner', meal: { id: 1, name: 'Pasta', effort: 3, hasRedMeat: false, url: '', mealType: 'dinner', ingredients: [], steps: [], lastPlanned: undefined } }
          ],
          shoppingList: []
        }
      };

      const { retryFetch } = await import('../utils.js');
      const { infoLog, errorLog } = await import('../logging.js');

      (retryFetch as jest.MockedFunction<any>).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse
      });

      const result = await generateMealPlan();

      expect(retryFetch).toHaveBeenCalledWith('http://test.com/api/mealplan/generate', { method: 'POST' });
      expect(result).toEqual(mockResponse);
      expect(infoLog).toHaveBeenCalledWith('🔧 [MCP-FETCH] About to fetch: http://test.com/api/mealplan/generate');
      expect(infoLog).toHaveBeenCalledWith('🔧 [MCP-FETCH] Successfully parsed JSON response');
    });

    it('should log environment variables and API details', async () => {
      const mockResponse: GenerateMealPlanResponse = {
        plan: { days: [], shoppingList: [] }
      };

      const { retryFetch } = await import('../utils.js');
      const { infoLog } = await import('../logging.js');

      (retryFetch as jest.MockedFunction<any>).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse
      });

      await generateMealPlan();

      expect(infoLog).toHaveBeenCalledWith('🔧 [MCP-FETCH] API variable: http://test.com');
      expect(infoLog).toHaveBeenCalledWith(`🔧 [MCP-FETCH] BACKEND_BASE_URL env: ${process.env.BACKEND_BASE_URL || 'NOT_SET'}`);
    });

    it('should log day index information for debugging', async () => {
      const mockResponse: GenerateMealPlanResponse = {
        plan: {
          days: [
            { dayIndex: 0, mealType: 'dinner', meal: { id: 1, name: 'Pasta', effort: 3, hasRedMeat: false, url: '', mealType: 'dinner', ingredients: [], steps: [], lastPlanned: undefined } },
            { dayIndex: 1, mealType: 'lunch', meal: { id: 2, name: 'Salad', effort: 1, hasRedMeat: false, url: '', mealType: 'lunch', ingredients: [], steps: [], lastPlanned: undefined } }
          ],
          shoppingList: []
        }
      };

      const { retryFetch } = await import('../utils.js');
      const { infoLog } = await import('../logging.js');

      (retryFetch as jest.MockedFunction<any>).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse
      });

      await generateMealPlan();

      expect(infoLog).toHaveBeenCalledWith('🔍 [MCP] Checking dayIndex values from backend:');
      expect(infoLog).toHaveBeenCalledWith('🔍 [MCP] Entry 0: dayIndex=0, mealType=dinner, meal=Pasta');
      expect(infoLog).toHaveBeenCalledWith('🔍 [MCP] Entry 1: dayIndex=1, mealType=lunch, meal=Salad');
    });

    it('should handle response with no meals', async () => {
      const mockResponse: GenerateMealPlanResponse = {
        plan: {
          days: [
            { dayIndex: 0, mealType: 'dinner', meal: undefined }
          ],
          shoppingList: []
        }
      };

      const { retryFetch } = await import('../utils.js');
      const { infoLog } = await import('../logging.js');

      (retryFetch as jest.MockedFunction<any>).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse
      });

      await generateMealPlan();

      expect(infoLog).toHaveBeenCalledWith('🔍 [MCP] Entry 0: dayIndex=0, mealType=dinner, meal=nil');
    });

    it('should throw McpError when response is not ok', async () => {
      const { retryFetch } = await import('../utils.js');
      const { errorLog } = await import('../logging.js');

      (retryFetch as jest.MockedFunction<any>).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error details'
      });

      await expect(generateMealPlan()).rejects.toThrow(McpError);
      await expect(generateMealPlan()).rejects.toThrow('BackendError: Internal Server Error');

      expect(errorLog).toHaveBeenCalledWith('🔧 [MCP-FETCH] Error response body: Server error details');
    });

    it('should handle retryFetch errors', async () => {
      const { retryFetch } = await import('../utils.js');
      const { errorLog } = await import('../logging.js');

      const fetchError = new Error('Network timeout');
      (retryFetch as jest.MockedFunction<any>).mockRejectedValue(fetchError);

      await expect(generateMealPlan()).rejects.toThrow(McpError);
      await expect(generateMealPlan()).rejects.toThrow('fetch failed: Error: Network timeout');

      expect(errorLog).toHaveBeenCalledWith('🔧 [MCP-FETCH] Fetch failed with error: Error: Network timeout');
    });

    it('should handle malformed JSON response', async () => {
      const { retryFetch } = await import('../utils.js');
      const { errorLog } = await import('../logging.js');

      (retryFetch as jest.MockedFunction<any>).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => { throw new Error('Invalid JSON'); }
      });

      await expect(generateMealPlan()).rejects.toThrow(McpError);

      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('🔧 [MCP-FETCH] Fetch failed with error:'));
    });
  });

  describe('registerGenerateMealPlan', () => {
    it('should register tool with server', () => {
      const mockServer = {
        tool: jest.fn()
      };

      registerGenerateMealPlan(mockServer);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'generateMealPlan',
        'Generate a new weekly meal plan with automatically selected recipes based on effort preferences and red meat consumption limits. This creates a complete 7-day meal plan.',
        expect.any(Function)
      );
    });

    it('should return formatted tool response when handler is called', async () => {
      const mockResponse: GenerateMealPlanResponse = {
        plan: {
          days: [{ dayIndex: 0, mealType: 'dinner', meal: { id: 1, name: 'Test Meal', effort: 3, hasRedMeat: false, url: '', mealType: 'dinner', ingredients: [], steps: [], lastPlanned: undefined } }],
          shoppingList: []
        }
      };

      const { retryFetch } = await import('../utils.js');

      (retryFetch as jest.MockedFunction<any>).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse
      });

      const mockServer = {
        tool: jest.fn()
      };

      registerGenerateMealPlan(mockServer);

      // Get the handler function that was registered
      const handler = (mockServer.tool as jest.MockedFunction<typeof handler>).mock.calls[0][2];
      const result = await handler();

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(mockResponse, null, 2) }]
      });
    });

    it('should propagate errors from generateMealPlan', async () => {
      const { retryFetch } = await import('../utils.js');

      (retryFetch as jest.MockedFunction<any>).mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: async () => 'Service down'
      });

      const mockServer = {
        tool: jest.fn()
      };

      registerGenerateMealPlan(mockServer);

      // Get the handler function that was registered
      const handler = (mockServer.tool as jest.MockedFunction<typeof handler>).mock.calls[0][2];

      await expect(handler()).rejects.toThrow(McpError);
      await expect(handler()).rejects.toThrow('BackendError: Service Unavailable');
    });
  });
});