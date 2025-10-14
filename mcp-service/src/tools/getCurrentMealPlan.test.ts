import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { doGetCurrentMealPlan, registerGetCurrentMealPlan } from './getCurrentMealPlan.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import fetchMock from 'jest-fetch-mock';
import { createMockServer } from '../utils/createMockServer.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

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
          id: 55,
          status: 'MEAL_PLAN_STATUS_FINALIZED',
          version: 4,
          items: [
            {
              id: 10,
              dayIndex: 0,
              mealType: 'MEAL_SLOT_DINNER',
              mealSnapshot: { id: 1, name: 'Test Meal' }
            }
          ]
        }
      };

      fetchMock.enableMocks();
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse), { status: 200 });

      const result = await doGetCurrentMealPlan();

      expect(fetchMock).toHaveBeenCalledWith('http://test.com/api/mealplan');
      expect(result).toEqual(mockResponse.plan);
    });

    it('should throw McpError when response is not ok', async () => {
      fetchMock.enableMocks();
      fetchMock.mockResponseOnce(JSON.stringify({}), { status: 404, statusText: 'Not Found' });

      await expect(doGetCurrentMealPlan()).rejects.toThrow(McpError);
    });

    it('should throw McpError when no meal plan returned', async () => {
      const mockResponse = { plan: null };

      fetchMock.enableMocks();
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse), { status: 200 });

      await expect(doGetCurrentMealPlan()).rejects.toThrow(McpError);
    });
  });

  describe('registerGetCurrentMealPlan', () => {
    it('should register tool with server', () => {
      const mockServer = {
        tool: jest.fn()
      } as unknown as McpServer;

      registerGetCurrentMealPlan(mockServer);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'getCurrentMealPlan',
        'Get the current meal plan showing slot assignments (status, version, and meal snapshots) for the active week. Provides context for which meals are currently planned.',
        expect.any(Function)
      );
    });

    it('should return formatted response from handler', async () => {
      const mockPlan = {
        id: 100,
        status: 'MEAL_PLAN_STATUS_DRAFT',
        version: 1,
        items: [
          {
            id: 200,
            dayIndex: 0,
            mealType: 'MEAL_SLOT_BREAKFAST',
            mealSnapshot: { id: 5, name: 'Test' }
          }
        ]
      };

      fetchMock.enableMocks();
      fetchMock.mockResponseOnce(JSON.stringify({ plan: mockPlan }), { status: 200 });

      const server = createMockServer();
      const mcpServer = server as unknown as McpServer;
      registerGetCurrentMealPlan(mcpServer);

      const handler = server.registeredTools!['getCurrentMealPlan'].handler;
      const result = await handler();

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(mockPlan, null, 2) }]
      });
    });
  });
});
