import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { doReplaceMeal, registerReplaceMeal, replaceArgs } from './replaceMeal.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import fetchMock from 'jest-fetch-mock';
import { createMockServer } from '../utils/createMockServer.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

interface MockResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
}

interface MockFetch {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface ToolHandler {
  (args: { day: string; mealType: string; newMealId: number }): Promise<{ content: Array<{ type: string; text: string }> }>;
}

// Mock the dependencies
jest.mock('../utils.js', () => ({
  API: 'http://test.com'
}));

jest.mock('@mealplanner/generated', () => {
  return {
    ReplaceMealRequest: jest.fn((data: unknown) => data),
    ReplaceMealResponse: {
      fromJson: jest.fn((data: unknown) => data)
    }
  };
});

describe('replaceMeal tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('replaceArgs schema', () => {
    it('should validate valid arguments', () => {
      const validData = {
        day: 'Monday',
        mealType: 'dinner' as const,
        newMealId: 123
      };
      const result = replaceArgs.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should validate all days', () => {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      days.forEach(day => {
        const args = { day, mealType: 'lunch' as const, newMealId: 1 };
        expect(replaceArgs.parse(args)).toEqual(args);
      });
    });

    it('should validate all meal types', () => {
      const mealTypes = ['breakfast', 'lunch', 'dinner'] as const;
      mealTypes.forEach(mealType => {
        const args = { day: 'Friday', mealType, newMealId: 1 };
        expect(replaceArgs.parse(args)).toEqual(args);
      });
    });

    it('should reject invalid meal types', () => {
      expect(() => replaceArgs.parse({ day: 'Monday', mealType: 'snack', newMealId: 1 })).toThrow();
    });

    it('should reject invalid meal IDs', () => {
      expect(() => replaceArgs.parse({ day: 'Monday', mealType: 'dinner', newMealId: 0 })).toThrow();
      expect(() => replaceArgs.parse({ day: 'Monday', mealType: 'dinner', newMealId: -1 })).toThrow();
      expect(() => replaceArgs.parse({ day: 'Monday', mealType: 'dinner', newMealId: 1.5 })).toThrow();
    });
  });

  describe('doReplaceMeal', () => {
    it('should replace meal successfully', async () => {
      const day = 'Wednesday';
      const mealType = 'lunch';
      const newMealId = 456;
      const mockResponse = {
        meal: { id: newMealId, name: 'New Meal', effort: 3 }
      };

      const { ReplaceMealRequest, ReplaceMealResponse } = await import('@mealplanner/generated');

      fetchMock.enableMocks();
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse), { status: 200 });

      const result = await doReplaceMeal(day, mealType, newMealId);

      expect(ReplaceMealRequest).toHaveBeenCalledWith({ day, newMealId });
      expect(global.fetch).toHaveBeenCalledWith('http://test.com/api/mealplan/replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day, newMealId })
      });
      const mockFromJsonFn = ReplaceMealResponse.fromJson as jest.MockedFunction<(data: unknown) => unknown>;
      expect(mockFromJsonFn).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual(mockResponse);
    });

    it('should throw McpError when response is not ok', async () => {
      fetchMock.enableMocks();
      fetchMock.mockResponseOnce(JSON.stringify({}), { status: 404, statusText: 'Not Found' });

      await expect(doReplaceMeal('Monday', 'dinner', 789)).rejects.toThrow(McpError);
    });

    it('should handle network errors', async () => {
      fetchMock.enableMocks();
      fetchMock.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(doReplaceMeal('Friday', 'breakfast', 123)).rejects.toThrow('Network timeout');
    });

    it('should handle different days and meal types', async () => {
      const mockResponse = { meal: { id: 1, name: 'New Meal' } };

      fetchMock.enableMocks();
      fetchMock.mockResponse(JSON.stringify(mockResponse), { status: 200 });

      const testCases = [
        { day: 'Sunday', mealType: 'breakfast', newMealId: 1 },
        { day: 'Tuesday', mealType: 'lunch', newMealId: 2 },
        { day: 'Thursday', mealType: 'dinner', newMealId: 3 }
      ];

      for (const testCase of testCases) {
        await doReplaceMeal(testCase.day, testCase.mealType, testCase.newMealId);
        expect(global.fetch).toHaveBeenCalledWith('http://test.com/api/mealplan/replace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ day: testCase.day, newMealId: testCase.newMealId })
        });
      }
    });
  });

  describe('registerReplaceMeal', () => {
    it('should register tool with server', () => {
      const mockServer = createMockServer();

      registerReplaceMeal(mockServer);

      expect(mockServer.registeredTools['replaceMeal']).toBeDefined();
      expect(mockServer.registeredTools['replaceMeal'].name).toBe('replaceMeal');
      expect(mockServer.registeredTools['replaceMeal'].handler).toBeDefined();
      expect(typeof mockServer.registeredTools['replaceMeal'].handler).toBe('function');
    });

    it('should return formatted response from handler', async () => {
      const mockResponse = {
        meal: { id: 42, name: 'Updated Meal' }
      };

      const mockFetchResponse: MockResponse = {
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as MockResponse;
      const mockFetch: MockFetch = jest.fn(() => Promise.resolve(mockFetchResponse as Response)) as MockFetch;
      Object.defineProperty(global, 'fetch', { 
        value: mockFetch, 
        writable: true 
      });

      const mockServer = createMockServer();

      registerReplaceMeal(mockServer);

      const handler = mockServer.registeredTools['replaceMeal'].handler as ToolHandler;
      const result = await handler({ day: 'Saturday', mealType: 'dinner', newMealId: 42 });

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(mockResponse, null, 2) }]
      });
    });

    it('should propagate errors from doReplaceMeal', async () => {
      const mockFetchResponse: MockResponse = {
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity'
      } as MockResponse;
      const mockFetch: MockFetch = jest.fn(() => Promise.resolve(mockFetchResponse as Response)) as MockFetch;
      Object.defineProperty(global, 'fetch', { 
        value: mockFetch, 
        writable: true 
      });

      const mockServer = createMockServer();

      registerReplaceMeal(mockServer);

      const handler = mockServer.registeredTools['replaceMeal'].handler as ToolHandler;

      await expect(handler({ day: 'Monday', mealType: 'breakfast', newMealId: 999 })).rejects.toThrow(McpError);
    });
  });
});
