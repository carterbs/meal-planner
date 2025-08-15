import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { doGetCurrentMealPlan, registerGetCurrentMealPlan } from './getCurrentMealPlan.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';

// Mock the dependencies
jest.mock('../utils.js', () => ({
  API: 'http://test.com'
}));

jest.mock('@mealplanner/generated', () => ({
  GetMealPlanResponse: {
    fromJson: jest.fn().mockImplementation((data) => data)
  }
}));

describe('getCurrentMealPlan tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('doGetCurrentMealPlan', () => {
    it('should get current meal plan successfully', async () => {
      const mockResponse = {
        plan: {
          days: [{ dayIndex: 0, mealType: 'dinner', meal: { id: 1, name: 'Test Meal' } }],
          shoppingList: []
        }
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const result = await doGetCurrentMealPlan();

      expect(global.fetch).toHaveBeenCalledWith('http://test.com/api/mealplan');
      expect(result).toEqual(mockResponse.plan);
    });

    it('should throw McpError when response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(doGetCurrentMealPlan()).rejects.toThrow(McpError);
      await expect(doGetCurrentMealPlan()).rejects.toThrow('BackendError: Not Found');
    });

    it('should throw McpError when no meal plan returned', async () => {
      const mockResponse = { plan: null };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      await expect(doGetCurrentMealPlan()).rejects.toThrow(McpError);
      await expect(doGetCurrentMealPlan()).rejects.toThrow('No meal plan returned from backend');
    });
  });

  describe('registerGetCurrentMealPlan', () => {
    it('should register tool with server', () => {
      const mockServer = {
        tool: jest.fn()
      };

      registerGetCurrentMealPlan(mockServer as any);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'getCurrentMealPlan',
        'Get the current weekly meal plan showing all scheduled meals by day and type (breakfast/lunch/dinner). Provides context for understanding what meals are currently planned and which ones might need replacement.',
        expect.any(Function)
      );
    });

    it('should return formatted response from handler', async () => {
      const mockPlan = {
        days: [{ dayIndex: 0, mealType: 'dinner', meal: { id: 1, name: 'Test' } }],
        shoppingList: []
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ plan: mockPlan })
      });

      const mockServer = {
        tool: jest.fn()
      };

      registerGetCurrentMealPlan(mockServer as any);

      const handler = (mockServer.tool as jest.MockedFunction<any>).mock.calls[0][2];
      const result = await handler();

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(mockPlan, null, 2) }]
      });
    });
  });
});