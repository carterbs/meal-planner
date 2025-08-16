import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { doGetMeals, registerGetMeals, getMealsArgs } from './getMeals.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import fetchMock from 'jest-fetch-mock';
import { createMockServer } from '../utils/createMockServer.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Mock the dependencies
jest.mock('../utils.js', () => ({
  API: 'http://test.com'
}));

jest.mock('@mealplanner/generated', () => ({
  GetAllMealsResponse: {
    fromJson: jest.fn().mockImplementation((data) => data)
  }
}));

describe('getMeals tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.enableMocks();
    fetchMock.resetMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getMealsArgs schema', () => {
    it('should validate valid meal types', () => {
      expect(getMealsArgs.parse({ mealType: 'breakfast' })).toEqual({ mealType: 'breakfast' });
      expect(getMealsArgs.parse({ mealType: 'lunch' })).toEqual({ mealType: 'lunch' });
      expect(getMealsArgs.parse({ mealType: 'dinner' })).toEqual({ mealType: 'dinner' });
      expect(getMealsArgs.parse({})).toEqual({});
    });

    it('should reject invalid meal types', () => {
      expect(() => getMealsArgs.parse({ mealType: 'snack' })).toThrow();
    });
  });

  describe('doGetMeals', () => {
    it('should get meals without filter', async () => {
      const mockResponse = {
        meals: [
          { id: 1, name: 'Pasta', effort: 3, hasRedMeat: false },
          { id: 2, name: 'Steak', effort: 5, hasRedMeat: true }
        ]
      };

      fetchMock.mockResponseOnce(JSON.stringify(mockResponse), { status: 200 });

      const result = await doGetMeals();

      expect(fetchMock).toHaveBeenCalledWith('http://test.com/api/meals');
      expect(result).toEqual(mockResponse.meals);
    });

    it('should get meals with meal type filter', async () => {
      const mockResponse = {
        meals: [{ id: 1, name: 'Breakfast Burrito', effort: 2, hasRedMeat: false }]
      };

      fetchMock.mockResponseOnce(JSON.stringify(mockResponse), { status: 200 });

      const result = await doGetMeals('breakfast');

      expect(fetchMock).toHaveBeenCalledWith('http://test.com/api/meals?type=breakfast');
      expect(result).toEqual(mockResponse.meals);
    });

    it('should throw McpError when response is not ok', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({}), { status: 500, statusText: 'Internal Server Error' });

      await expect(doGetMeals()).rejects.toThrow(McpError);
    });
  });

  describe('registerGetMeals', () => {
    it('should register tool with server', () => {
      const mockServer = {
        tool: jest.fn()
      } as unknown as McpServer;

      registerGetMeals(mockServer);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'getMeals',
        'Fetch all available meals with detailed metadata including effort levels, meal types, red meat status, and last planned dates. Essential for making informed meal replacement decisions.',
        { mealType: getMealsArgs.shape.mealType },
        expect.any(Function)
      );
    });

    it('should return formatted response from handler', async () => {
      const mockMeals = [{ id: 1, name: 'Test Meal', effort: 3 }];

      fetchMock.mockResponseOnce(JSON.stringify({ meals: mockMeals }), { status: 200 });

      const server = createMockServer();
      const mcpServer = server as unknown as McpServer;
      registerGetMeals(mcpServer);

      const handler = server.registeredTools!['getMeals'].handler;
      const result = await handler({ mealType: 'dinner' });

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(mockMeals, null, 2) }]
      });
    });
  });
});