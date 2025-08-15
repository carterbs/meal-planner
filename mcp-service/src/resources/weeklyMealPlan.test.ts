import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { fetchWeeklyMealPlan, registerWeeklyMealPlan } from './weeklyMealPlan.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { API } from '../utils.js';

// Mock the utils module
jest.mock('../utils.js', () => ({
  API: 'http://test.com'
}));

describe('weeklyMealPlan resource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fetchWeeklyMealPlan', () => {
    it('should fetch weekly meal plan successfully', async () => {
      const mockData = {
        plan: {
          days: [
            { date: '2024-01-01', meals: [] }
          ],
          shoppingList: []
        }
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData
      });

      const result = await fetchWeeklyMealPlan();

      expect(global.fetch).toHaveBeenCalledWith(`${API}/api/mealplan`);
      expect(result).toEqual(mockData);
    });

    it('should throw McpError when fetch fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error'
      });

      await expect(fetchWeeklyMealPlan()).rejects.toThrow(McpError);
      await expect(fetchWeeklyMealPlan()).rejects.toThrow('BackendError: Internal Server Error');
    });

    it('should handle network errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(fetchWeeklyMealPlan()).rejects.toThrow('Network error');
    });
  });

  describe('registerWeeklyMealPlan', () => {
    it('should register resource with server', () => {
      const mockServer = {
        resource: jest.fn()
      };

      registerWeeklyMealPlan(mockServer as any);

      expect(mockServer.resource).toHaveBeenCalledWith(
        'WeeklyMealPlan',
        'meal://plan/weekly',
        {
          description: 'Get the current weekly meal plan showing planned meals for each day of the week with dates, meal names, and effort levels (LOW/MED/HIGH)',
          mimeType: 'application/json'
        },
        expect.any(Function)
      );
    });

    it('should return formatted resource data when handler is called', async () => {
      const mockData = {
        plan: {
          days: [{ date: '2024-01-01', meals: [] }],
          shoppingList: []
        }
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData
      });

      const mockServer = {
        resource: jest.fn()
      };

      registerWeeklyMealPlan(mockServer as any);

      // Get the handler function that was registered
      const handler = (mockServer.resource as jest.MockedFunction<any>).mock.calls[0][3];
      const result = await handler();

      expect(result).toEqual({
        contents: [{
          uri: 'meal://plan/weekly',
          text: JSON.stringify(mockData, null, 2),
          mimeType: 'application/json'
        }]
      });
    });

    it('should propagate errors from fetchWeeklyMealPlan', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: 'Bad Request'
      });

      const mockServer = {
        resource: jest.fn()
      };

      registerWeeklyMealPlan(mockServer as any);

      // Get the handler function that was registered
      const handler = (mockServer.resource as jest.MockedFunction<any>).mock.calls[0][3];

      await expect(handler()).rejects.toThrow(McpError);
      await expect(handler()).rejects.toThrow('BackendError: Bad Request');
    });
  });
});