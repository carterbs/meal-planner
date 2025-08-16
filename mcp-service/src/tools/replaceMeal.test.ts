import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { doReplaceMeal, registerReplaceMeal, replaceArgs } from './replaceMeal.js';
import { McpError, McpServer } from '@modelcontextprotocol/sdk/types.js';

// Mock the dependencies
jest.mock('../utils.js', () => ({
  API: 'http://test.com'
}));

jest.mock('@mealplanner/generated', () => ({
  ReplaceMealRequest: jest.fn().mockImplementation((data) => data),
  ReplaceMealResponse: {
    fromJson: jest.fn().mockImplementation((data) => data)
  }
}));

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
        success: true, 
        updatedPlan: { days: [], shoppingList: [] },
        replacedMeal: { id: newMealId, name: 'New Meal' }
      };

      const { ReplaceMealRequest, ReplaceMealResponse } = await import('@mealplanner/generated');

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const result = await doReplaceMeal(day, mealType, newMealId);

      expect(ReplaceMealRequest).toHaveBeenCalledWith({ day, newMealId });
      expect(global.fetch).toHaveBeenCalledWith('http://test.com/api/mealplan/replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day, newMealId })
      });
      expect(ReplaceMealResponse.fromJson).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual(mockResponse);
    });

    it('should throw McpError when response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(doReplaceMeal('Monday', 'dinner', 789)).rejects.toThrow(McpError);
      await expect(doReplaceMeal('Monday', 'dinner', 789)).rejects.toThrow('BackendError: Not Found');
    });

    it('should handle network errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network timeout'));

      await expect(doReplaceMeal('Friday', 'breakfast', 123)).rejects.toThrow('Network timeout');
    });

    it('should handle different days and meal types', async () => {
      const mockResponse = { success: true };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

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
      const mockServer = {
        tool: jest.fn()
      };

      registerReplaceMeal(mockServer);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'replaceMeal',
        'Replace a specific meal in the weekly meal plan. Use this after analyzing available meals and current plan to make an intelligent substitution. Consider effort levels (Monday: 0-2, Tue-Thu/Sat: 3-5, Sunday: 6-100), red meat limits (max 1 per week), and meal type compatibility.',
        {
          day: replaceArgs.shape.day,
          mealType: replaceArgs.shape.mealType,
          newMealId: replaceArgs.shape.newMealId
        },
        expect.any(Function)
      );
    });

    it('should return formatted response from handler', async () => {
      const mockResponse = {
        success: true,
        updatedPlan: { days: [], shoppingList: [] }
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const mockServer = {
        tool: jest.fn()
      };

      registerReplaceMeal(mockServer);

      const handler = (mockServer.tool as jest.MockedFunction<typeof handler>).mock.calls[0][3];
      const result = await handler({ day: 'Saturday', mealType: 'dinner', newMealId: 42 });

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(mockResponse, null, 2) }]
      });
    });

    it('should propagate errors from doReplaceMeal', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity'
      });

      const mockServer = {
        tool: jest.fn()
      };

      registerReplaceMeal(mockServer);

      const handler = (mockServer.tool as jest.MockedFunction<typeof handler>).mock.calls[0][3];

      await expect(handler({ day: 'Monday', mealType: 'breakfast', newMealId: 999 })).rejects.toThrow(McpError);
      await expect(handler({ day: 'Monday', mealType: 'breakfast', newMealId: 999 })).rejects.toThrow('BackendError: Unprocessable Entity');
    });
  });
});