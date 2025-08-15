import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { generateList, registerGenerateShoppingList } from './generateShoppingList.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';

// Mock the dependencies
jest.mock('../logging.js', () => ({
  infoLog: jest.fn().mockResolvedValue(undefined),
  warnLog: jest.fn().mockResolvedValue(undefined),
  errorLog: jest.fn().mockResolvedValue(undefined)
}));

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

      const { infoLog } = await import('../logging.js');

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const result = await generateList(plan);

      expect(global.fetch).toHaveBeenCalledWith('http://test.com/api/shoppinglist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
      });
      expect(infoLog).toHaveBeenCalledWith('🛒 [MCP] Generating shopping list for plan: 1,2,3');
      expect(result).toEqual(mockResponse);
    });

    it('should throw McpError when response is not ok', async () => {
      const plan = [1, 2];
      const errorResponse = { message: 'Invalid meal plan' };

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => errorResponse
      });

      await expect(generateList(plan)).rejects.toThrow(McpError);
      await expect(generateList(plan)).rejects.toThrow('BackendError: 400 Bad Request - Invalid meal plan');
    });

    it('should handle JSON parsing errors in error response', async () => {
      const plan = [1];

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => { throw new Error('Invalid JSON'); }
      });

      await expect(generateList(plan)).rejects.toThrow(McpError);
      await expect(generateList(plan)).rejects.toThrow('BackendError: 500 Internal Server Error - Unknown error');
    });
  });

  describe('registerGenerateShoppingList', () => {
    it('should register tool with server', () => {
      const mockServer = {
        tool: jest.fn()
      };

      registerGenerateShoppingList(mockServer as any);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'generateShoppingList',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should return formatted tool response', async () => {
      const mockResponse = { items: [] };
      const testPlan = [1, 2, 3];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const mockServer = {
        tool: jest.fn()
      };

      registerGenerateShoppingList(mockServer as any);

      const handler = (mockServer.tool as jest.MockedFunction<any>).mock.calls[0][3];
      const result = await handler({ plan: testPlan });

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(mockResponse, null, 2) }]
      });
    });
  });
});