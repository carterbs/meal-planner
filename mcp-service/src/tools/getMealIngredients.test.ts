import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { doGetMealIngredients, registerGetMealIngredients, getMealIngredientsArgs } from './getMealIngredients.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { createMockServer } from '../utils/createMockServer.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as gatewayModule from '@mealplanner/generated/gateway';

// Mock the gateway module
jest.mock('@mealplanner/generated/gateway');
jest.mock('@mealplanner/generated/gateway/client', () => ({
  createClient: jest.fn(() => 'mockClient'),
}));

const mockedGateway = gatewayModule as jest.Mocked<typeof gatewayModule>;

describe('getMealIngredients tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getMealIngredientsArgs schema', () => {
    it('should validate valid meal ID', () => {
      expect(getMealIngredientsArgs.parse({ mealId: 1 })).toEqual({ mealId: 1 });
      expect(getMealIngredientsArgs.parse({ mealId: 123 })).toEqual({ mealId: 123 });
    });

    it('should reject invalid meal IDs', () => {
      expect(() => getMealIngredientsArgs.parse({ mealId: 0 })).toThrow();
      expect(() => getMealIngredientsArgs.parse({ mealId: -1 })).toThrow();
      expect(() => getMealIngredientsArgs.parse({ mealId: 'abc' })).toThrow();
      expect(() => getMealIngredientsArgs.parse({})).toThrow();
    });
  });

  describe('doGetMealIngredients', () => {
    const mockIngredients = [
      { id: 1, mealId: 1, name: 'tomatoes', quantity: 2, unit: 'cups' },
      { id: 2, mealId: 1, name: 'onions', quantity: 1, unit: 'piece' }
    ];

    const mockMeal = {
      id: 1,
      name: 'Test Meal',
      effort: 3,
      hasRedMeat: false,
      ingredients: mockIngredients
    };

    it('should get ingredients for a meal successfully', async () => {
      mockedGateway.getMeals.mockResolvedValue({
        data: { meals: [mockMeal] },
        error: null,
      } as any);

      const result = await doGetMealIngredients(1);

      expect(mockedGateway.getMeals).toHaveBeenCalledWith({
        client: expect.any(String)
      });
      expect(result).toEqual(mockIngredients);
    });

    it('should return empty array when meal has no ingredients', async () => {
      const mealWithoutIngredients = { ...mockMeal, ingredients: [] };
      
      mockedGateway.getMeals.mockResolvedValue({
        data: { meals: [mealWithoutIngredients] },
        error: null,
      } as any);

      const result = await doGetMealIngredients(1);

      expect(result).toEqual([]);
    });

    it('should handle undefined ingredients', async () => {
      const mealWithUndefinedIngredients = { ...mockMeal, ingredients: undefined };
      
      mockedGateway.getMeals.mockResolvedValue({
        data: { meals: [mealWithUndefinedIngredients] },
        error: null,
      } as any);

      const result = await doGetMealIngredients(1);

      expect(result).toEqual([]);
    });

    it('should throw McpError when meal not found', async () => {
      mockedGateway.getMeals.mockResolvedValue({
        data: { meals: [] },
        error: null,
      } as any);

      await expect(doGetMealIngredients(1)).rejects.toThrow(McpError);
      await expect(doGetMealIngredients(1)).rejects.toThrow('Meal with ID 1 not found');
    });

    it('should throw McpError when backend returns no meals', async () => {
      mockedGateway.getMeals.mockResolvedValue({
        data: null,
        error: null,
      } as any);

      await expect(doGetMealIngredients(1)).rejects.toThrow(McpError);
      await expect(doGetMealIngredients(1)).rejects.toThrow('No meals returned from backend');
    });

    it('should throw McpError when API returns error', async () => {
      mockedGateway.getMeals.mockResolvedValue({
        data: null,
        error: 'Network error',
      } as any);

      await expect(doGetMealIngredients(1)).rejects.toThrow(McpError);
      await expect(doGetMealIngredients(1)).rejects.toThrow('Backend error: Network error');
    });

    it('should throw McpError when API call throws', async () => {
      mockedGateway.getMeals.mockRejectedValue(new Error('Connection failed'));

      await expect(doGetMealIngredients(1)).rejects.toThrow(McpError);
      await expect(doGetMealIngredients(1)).rejects.toThrow('Backend error: Error: Connection failed');
    });
  });

  describe('registerGetMealIngredients', () => {
    it('should register tool with server', () => {
      const mockServer = {
        tool: jest.fn()
      } as unknown as McpServer;

      registerGetMealIngredients(mockServer);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'getMealIngredients',
        'Fetch all ingredients for a specific meal, including quantities, units, and names. Essential for understanding meal composition and managing ingredient lists.',
        { mealId: getMealIngredientsArgs.shape.mealId },
        expect.any(Function)
      );
    });

    it('should return formatted response from handler', async () => {
      const mockIngredients = [
        { id: 1, mealId: 1, name: 'tomatoes', quantity: 2, unit: 'cups' }
      ];

      mockedGateway.getMeals.mockResolvedValue({
        data: { meals: [{ id: 1, ingredients: mockIngredients }] },
        error: null,
      } as any);

      const server = createMockServer();
      const mcpServer = server as unknown as McpServer;
      registerGetMealIngredients(mcpServer);

      const handler = server.registeredTools!['getMealIngredients'].handler;
      const result = await handler({ mealId: 1 });

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(mockIngredients, null, 2) }]
      });
    });
  });
});