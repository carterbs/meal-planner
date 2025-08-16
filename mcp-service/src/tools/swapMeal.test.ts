import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { doSwapMeal, registerSwapMeal, swapArgs } from './swapMeal.js';
import { McpError, McpServer } from '@modelcontextprotocol/sdk/types.js';
import type { SwapMealRequest, SwapMealResponse } from '@mealplanner/generated';

// Mock the dependencies
jest.mock('../utils.js', () => ({
  API: 'http://test.com'
}));

jest.mock('@mealplanner/generated', () => ({
  SwapMealRequest: jest.fn().mockImplementation((data) => ({
    ...data,
    toJson: jest.fn().mockImplementation(() => data)
  })),
  SwapMealResponse: {
    fromJson: jest.fn().mockImplementation((data) => data)
  }
}));

describe('swapMeal tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('swapArgs schema', () => {
    it('should validate valid day indices', () => {
      for (let i = 0; i <= 6; i++) {
        const result = swapArgs.parse({ dayIndex: i });
        expect(result).toEqual({ dayIndex: i });
      }
    });

    it('should reject invalid day indices', () => {
      expect(() => swapArgs.parse({ dayIndex: -1 })).toThrow();
      expect(() => swapArgs.parse({ dayIndex: 7 })).toThrow();
      expect(() => swapArgs.parse({ dayIndex: 1.5 })).toThrow();
      expect(() => swapArgs.parse({ dayIndex: 'monday' })).toThrow();
      expect(() => swapArgs.parse({})).toThrow();
    });
  });

  describe('doSwapMeal', () => {
    it('should swap meal successfully', async () => {
      const dayIndex = 3;
      const mockResponse = {
        meal: {
          id: 123,
          name: 'New Meal',
          effort: 3,
          hasRedMeat: false,
          url: 'http://example.com/recipe',
          mealType: 'dinner',
          ingredients: [],
          steps: [],
          lastPlanned: undefined
        }
      };

      const { SwapMealRequest, SwapMealResponse } = await import('@mealplanner/generated');

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse
      });

      const result = await doSwapMeal(dayIndex);

      expect(SwapMealRequest).toHaveBeenCalledWith({
        mealId: 0,
        mealType: 'dinner'
      });

      expect(global.fetch).toHaveBeenCalledWith('http://test.com/api/meals/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mealId: 0,
          mealType: 'dinner'
        })
      });

      expect(SwapMealResponse.fromJson).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual(mockResponse);
    });

    it('should create SwapMealRequest with default values', async () => {
      const { SwapMealRequest } = await import('@mealplanner/generated');

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ meal: null })
      });

      await doSwapMeal(0);

      expect(SwapMealRequest).toHaveBeenCalledWith({
        mealId: 0,
        mealType: 'dinner'
      });

      const mockRequest = (SwapMealRequest as jest.MockedFunction<typeof mockRequest>).mock.results[0].value;
      expect(mockRequest.toJson).toHaveBeenCalledWith({ emitDefaultValues: true });
    });

    it('should throw McpError when response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Meal not found'
      });

      await expect(doSwapMeal(2)).rejects.toThrow(McpError);
      await expect(doSwapMeal(2)).rejects.toThrow('BackendError: Meal not found');
    });

    it('should handle network errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Connection timeout'));

      await expect(doSwapMeal(1)).rejects.toThrow('Connection timeout');
    });

    it('should handle JSON parsing errors', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => { throw new Error('Invalid JSON response'); }
      });

      await expect(doSwapMeal(4)).rejects.toThrow('Invalid JSON response');
    });

    it('should work with all valid dayIndex values', async () => {
      const mockResponse = { meal: { id: 1, name: 'Test' } };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse
      });

      for (let dayIndex = 0; dayIndex <= 6; dayIndex++) {
        await doSwapMeal(dayIndex);
        expect(global.fetch).toHaveBeenCalledWith('http://test.com/api/meals/swap', expect.any(Object));
      }

      expect(global.fetch).toHaveBeenCalledTimes(7);
    });
  });

  describe('registerSwapMeal', () => {
    it('should register tool with server', () => {
      const mockServer = {
        tool: jest.fn()
      };

      registerSwapMeal(mockServer);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'swapMeal',
        'Randomly swap a meal on a specific day with an alternative meal of the same type. Uses the backend\'s random meal selection to provide variety while maintaining meal type compatibility.',
        {
          dayIndex: swapArgs.shape.dayIndex
        },
        expect.any(Function)
      );
    });

    it('should return formatted tool response when handler is called', async () => {
      const dayIndex = 5;
      const mockResponse = {
        meal: {
          id: 456,
          name: 'Swapped Meal',
          effort: 2,
          hasRedMeat: true,
          url: '',
          mealType: 'dinner',
          ingredients: ['beef', 'potatoes'],
          steps: [],
          lastPlanned: undefined
        }
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

      registerSwapMeal(mockServer);

      // Get the handler function that was registered
      const handler = (mockServer.tool as jest.MockedFunction<typeof handler>).mock.calls[0][3];
      const result = await handler({ dayIndex });

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(mockResponse, null, 2) }]
      });
    });

    it('should validate dayIndex in handler', async () => {
      const mockServer = {
        tool: jest.fn()
      };

      registerSwapMeal(mockServer);

      // Get the handler function that was registered
      const handler = (mockServer.tool as jest.MockedFunction<typeof handler>).mock.calls[0][3];

      // The tool handler should receive validated dayIndex from the MCP server
      // so we test with valid values
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ meal: null })
      });

      await expect(handler({ dayIndex: 0 })).resolves.toBeDefined();
      await expect(handler({ dayIndex: 6 })).resolves.toBeDefined();
    });

    it('should propagate errors from doSwapMeal', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const mockServer = {
        tool: jest.fn()
      };

      registerSwapMeal(mockServer);

      // Get the handler function that was registered
      const handler = (mockServer.tool as jest.MockedFunction<typeof handler>).mock.calls[0][3];

      await expect(handler({ dayIndex: 2 })).rejects.toThrow(McpError);
      await expect(handler({ dayIndex: 2 })).rejects.toThrow('BackendError: Internal Server Error');
    });

    it('should handle edge case day indices correctly', async () => {
      const mockResponse = { meal: { id: 1, name: 'Edge case meal' } };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse
      });

      const mockServer = {
        tool: jest.fn()
      };

      registerSwapMeal(mockServer);

      // Get the handler function that was registered
      const handler = (mockServer.tool as jest.MockedFunction<typeof handler>).mock.calls[0][3];

      // Test Monday (0) and Sunday (6)
      await handler({ dayIndex: 0 });
      await handler({ dayIndex: 6 });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});