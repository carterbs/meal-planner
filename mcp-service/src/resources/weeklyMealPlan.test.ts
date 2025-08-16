import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { fetchWeeklyMealPlan, registerWeeklyMealPlan } from './weeklyMealPlan.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { API } from '../utils.js';
import { createMockServer } from '../utils/createMockServer.js';
// Type definitions for mocks



type MockedResourceHandler = jest.MockedFunction<() => Promise<{ contents: Array<{ uri: string; text: string; mimeType: string }> }>>;

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

      const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockData
      } as unknown as Response);
      global.fetch = fetchMock;

      const result = await fetchWeeklyMealPlan();

      expect(global.fetch).toHaveBeenCalledWith(`${API}/api/mealplan`);
      expect(result).toEqual(mockData);
    });

    it('should throw McpError when fetch fails', async () => {
      const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
      fetchMock.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error'
      } as unknown as Response);
      global.fetch = fetchMock;

      await expect(fetchWeeklyMealPlan()).rejects.toThrow(McpError);
      await expect(fetchWeeklyMealPlan()).rejects.toThrow('BackendError: Internal Server Error');
    });

    it('should handle network errors', async () => {
      const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
      fetchMock.mockRejectedValue(new Error('Network error'));
      global.fetch = fetchMock;

      await expect(fetchWeeklyMealPlan()).rejects.toThrow('Network error');
    });
  });

  describe('registerWeeklyMealPlan', () => {
    it('should register resource with server', () => {
      const mockServer = createMockServer();

      registerWeeklyMealPlan(mockServer as unknown as McpServer);

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

      const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockData
      } as unknown as Response);
      global.fetch = fetchMock;

      const mockServer = createMockServer();

      registerWeeklyMealPlan(mockServer as unknown as McpServer);

      // Get the handler function that was registered
      const handler = (mockServer as unknown as { resource: { mock: { calls: Array<[string, string, object, MockedResourceHandler]> } } }).resource.mock.calls[0][3];
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
      const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
      fetchMock.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request'
      } as unknown as Response);
      global.fetch = fetchMock;

      const mockServer = createMockServer();

      registerWeeklyMealPlan(mockServer as unknown as McpServer);

      // Get the handler function that was registered
      const handler = (mockServer as unknown as { resource: { mock: { calls: Array<[string, string, object, MockedResourceHandler]> } } }).resource.mock.calls[0][3];

      await expect(handler()).rejects.toThrow(McpError);
      await expect(handler()).rejects.toThrow('BackendError: Bad Request');
    });
  });
});