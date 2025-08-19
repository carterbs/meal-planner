import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { doSwapMeal, registerSwapMeal, swapArgs } from './swapMeal.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import fetchMock from 'jest-fetch-mock';
import { createMockServer } from '../utils/createMockServer.js';
import type { SwapMealRequest, SwapMealResponse } from '@mealplanner/generated';

// Mock the dependencies
jest.mock('../utils.js', () => ({
  API: 'http://test.com'
}));

jest.mock('@mealplanner/generated', () => {
  return {
    SwapMealRequest: jest.fn((data: unknown) => ({
      toJson: jest.fn(() => data)
    })),
    SwapMealResponse: {
      fromJson: jest.fn((data: unknown) => data)
    }
  };
});

describe('swapMeal tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.enableMocks();
    fetchMock.resetMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fetchMock.resetMocks();
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

      fetchMock.mockResponseOnce(JSON.stringify(mockResponse), { status: 200, statusText: 'OK' });

      const result = await doSwapMeal(dayIndex);

      expect(SwapMealRequest).toHaveBeenCalledWith({
        mealId: 0,
        mealType: 'dinner'
      });

      expect(fetchMock).toHaveBeenCalledWith('http://test.com/api/meals/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mealId: 0,
          mealType: 'dinner'
        })
      });

      const mockFromJsonFn = SwapMealResponse.fromJson as jest.MockedFunction<(data: unknown) => unknown>;
      expect(mockFromJsonFn).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual(mockResponse);
    });

    it('should create SwapMealRequest with default values', async () => {
      const { SwapMealRequest } = await import('@mealplanner/generated');

      fetchMock.mockResponseOnce(JSON.stringify({ meal: null }), { status: 200, statusText: 'OK' });

      await doSwapMeal(0);

      expect(SwapMealRequest).toHaveBeenCalledWith({
        mealId: 0,
        mealType: 'dinner'
      });

      const mockRequest = (SwapMealRequest as unknown as jest.Mock).mock.results[0].value as { toJson: jest.Mock };
      expect(mockRequest.toJson).toHaveBeenCalledWith({ emitDefaultValues: true });
    });

    it('should throw McpError when response is not ok', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({}), { status: 404, statusText: 'Meal not found' });

      await expect(doSwapMeal(2)).rejects.toThrow(McpError);
    });

    it('should handle network errors', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Connection timeout'));

      await expect(doSwapMeal(1)).rejects.toThrow('Connection timeout');
    });

    it('should handle JSON parsing errors', async () => {
      fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: async () => { throw new Error('Invalid JSON response'); } } as unknown as Response));

      await expect(doSwapMeal(4)).rejects.toThrow('Invalid JSON response');
    });

    it('should work with all valid dayIndex values', async () => {
      const mockResponse = { meal: { id: 1, name: 'Test' } };

      fetchMock.mockResponse(JSON.stringify(mockResponse), { status: 200, statusText: 'OK' });

      for (let dayIndex = 0; dayIndex <= 6; dayIndex++) {
        await doSwapMeal(dayIndex);
        expect(fetchMock).toHaveBeenCalledWith('http://test.com/api/meals/swap', expect.any(Object));
      }

      expect(fetchMock).toHaveBeenCalledTimes(7);
    });
  });

  describe('registerSwapMeal', () => {
    it('should register tool with server', () => {
      const server = createMockServer();

      registerSwapMeal(server);

      expect(server.registeredTools['swapMeal']).toBeDefined();
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

      fetchMock.mockResponseOnce(JSON.stringify(mockResponse), { status: 200, statusText: 'OK' });

      const server = createMockServer();
      registerSwapMeal(server);

      const handler = server.registeredTools['swapMeal'].handler;
      const result = await handler({ dayIndex });

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(mockResponse, null, 2) }]
      });
    });

    it('should validate dayIndex in handler', async () => {
      const server = createMockServer();

      registerSwapMeal(server);

      const handler = server.registeredTools['swapMeal'].handler;

      // The tool handler should receive validated dayIndex from the MCP server
      // so we test with valid values
      fetchMock.mockResponse(JSON.stringify({ meal: null }), { status: 200, statusText: 'OK' });

      await expect(handler({ dayIndex: 0 })).resolves.toBeDefined();
      await expect(handler({ dayIndex: 6 })).resolves.toBeDefined();
    });

    it('should propagate errors from doSwapMeal', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({}), { status: 500, statusText: 'Internal Server Error' });

      const server = createMockServer();
      registerSwapMeal(server);

      const handler = server.registeredTools['swapMeal'].handler;

      await expect(handler({ dayIndex: 2 })).rejects.toThrow(McpError);
    });

    it('should handle edge case day indices correctly', async () => {
      const mockResponse = { meal: { id: 1, name: 'Edge case meal' } };

      fetchMock.mockResponse(JSON.stringify(mockResponse), { status: 200, statusText: 'OK' });

      const server = createMockServer();
      registerSwapMeal(server);

      const handler = server.registeredTools['swapMeal'].handler;

      // Test Monday (0) and Sunday (6)
      await handler({ dayIndex: 0 });
      await handler({ dayIndex: 6 });

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});