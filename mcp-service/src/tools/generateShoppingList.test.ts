import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { generateList, registerGenerateShoppingList } from './generateShoppingList.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import fetchMock from 'jest-fetch-mock';
import { createMockServer } from '../utils/createMockServer.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Mock the dependencies
jest.mock('../logging.js', () => {
  return {
    infoLog: jest.fn(),
    warnLog: jest.fn(),
    errorLog: jest.fn()
  }
});

jest.mock('../utils.js', () => ({
  API: 'http://test.com'
}));

jest.mock('@mealplanner/generated', () => ({
  GetShoppingListRequest: jest.fn().mockImplementation((data) => data),
  GetShoppingListResponse: {
    fromJson: jest.fn().mockImplementation((data) => data)
  }
}));

describe('generateShoppingList tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateList', () => {
    it('should generate shopping list successfully', async () => {
      const plan = [1, 2, 3];
      const mockResponse = {
        items: [
          { name: 'Milk', quantity: '1 gallon' },
          { name: 'Bread', quantity: '2 loaves' }
        ]
      };

      fetchMock.enableMocks();
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse), { status: 200 });

      const result = await generateList(plan);

      expect(fetchMock).toHaveBeenCalledWith('http://test.com/api/shoppinglist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
      });
      expect(result).toEqual(mockResponse);
    });

    it('should throw McpError when response is not ok', async () => {
      const plan = [1, 2];
      const errorResponse = { message: 'Invalid meal plan' };

      fetchMock.enableMocks();
      fetchMock.mockResponseOnce(JSON.stringify(errorResponse), { status: 400, statusText: 'Bad Request' });

      await expect(generateList(plan)).rejects.toThrow('BackendError: 400 Bad Request - Invalid meal plan');
    });

    it('should handle JSON parsing errors in error response', async () => {
      const plan = [1];

      fetchMock.enableMocks();
      fetchMock.mockResponseOnce('', { status: 500, statusText: 'Internal Server Error' });

      await expect(generateList(plan)).rejects.toThrow('BackendError: 500 Internal Server Error - Unknown error');
    });
  });

  describe('registerGenerateShoppingList', () => {
    it('should register tool with server', () => {
      const mockServer = createMockServer()

      registerGenerateShoppingList(mockServer);

      expect(mockServer.registeredTools['generateShoppingList']).toBeDefined();
    });

    it('should return formatted tool response', async () => {
      const mockResponse = { items: [] };
      const testPlan = [1, 2, 3];

      fetchMock.enableMocks();
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse), { status: 200 });

      const server = createMockServer();
      const mcpServer = server as unknown as McpServer;
      registerGenerateShoppingList(mcpServer);

      const handler = server.registeredTools!['generateShoppingList'].handler;
      const result = await handler({ plan: testPlan });

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(mockResponse, null, 2) }]
      });
    });
  });
});