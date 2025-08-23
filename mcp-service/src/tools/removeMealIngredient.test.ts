import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { doRemoveMealIngredient, registerRemoveMealIngredient, removeMealIngredientArgs } from './removeMealIngredient.js';
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

describe('removeMealIngredient tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('removeMealIngredientArgs schema', () => {
    it('should validate valid input', () => {
      const input = {
        mealId: 1,
        ingredientId: 2
      };
      expect(removeMealIngredientArgs.parse(input)).toEqual(input);
    });

    it('should reject invalid meal ID', () => {
      expect(() => removeMealIngredientArgs.parse({ mealId: 0, ingredientId: 1 })).toThrow();
      expect(() => removeMealIngredientArgs.parse({ mealId: -1, ingredientId: 1 })).toThrow();
      expect(() => removeMealIngredientArgs.parse({ mealId: 'abc', ingredientId: 1 })).toThrow();
    });

    it('should reject invalid ingredient ID', () => {
      expect(() => removeMealIngredientArgs.parse({ mealId: 1, ingredientId: 0 })).toThrow();
      expect(() => removeMealIngredientArgs.parse({ mealId: 1, ingredientId: -1 })).toThrow();
      expect(() => removeMealIngredientArgs.parse({ mealId: 1, ingredientId: 'abc' })).toThrow();
    });

    it('should require both mealId and ingredientId', () => {
      expect(() => removeMealIngredientArgs.parse({ mealId: 1 })).toThrow();
      expect(() => removeMealIngredientArgs.parse({ ingredientId: 1 })).toThrow();
      expect(() => removeMealIngredientArgs.parse({})).toThrow();
    });
  });

  describe('doRemoveMealIngredient', () => {
    const mockUpdatedMeal = {
      id: 1,
      name: 'Test Meal',
      effort: 3,
      hasRedMeat: false,
      ingredients: [] // Empty after removal
    };

    it('should remove ingredient successfully', async () => {
      mockedGateway.deleteMealsByMealIdIngredientsByIngredientId.mockResolvedValue({
        data: { meal: mockUpdatedMeal },
        error: null,
      } as any);

      const result = await doRemoveMealIngredient(1, 2);

      expect(mockedGateway.deleteMealsByMealIdIngredientsByIngredientId).toHaveBeenCalledWith({
        client: expect.any(String),
        path: { mealId: '1', ingredientId: '2' }
      });
      expect(result).toEqual(mockUpdatedMeal);
    });

    it('should throw McpError when no meal returned', async () => {
      mockedGateway.deleteMealsByMealIdIngredientsByIngredientId.mockResolvedValue({
        data: {},
        error: null,
      } as any);

      await expect(doRemoveMealIngredient(1, 2)).rejects.toThrow(McpError);
      await expect(doRemoveMealIngredient(1, 2)).rejects.toThrow('No meal returned from remove ingredient request');
    });

    it('should throw McpError when API returns error', async () => {
      mockedGateway.deleteMealsByMealIdIngredientsByIngredientId.mockResolvedValue({
        data: null,
        error: 'Deletion failed',
      } as any);

      await expect(doRemoveMealIngredient(1, 2)).rejects.toThrow(McpError);
      await expect(doRemoveMealIngredient(1, 2)).rejects.toThrow('Backend error: Deletion failed');
    });

    it('should throw McpError when API returns error object', async () => {
      mockedGateway.deleteMealsByMealIdIngredientsByIngredientId.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      } as any);

      await expect(doRemoveMealIngredient(1, 2)).rejects.toThrow(McpError);
      await expect(doRemoveMealIngredient(1, 2)).rejects.toThrow('Backend error: [object Object]');
    });

    it('should throw McpError when API call throws', async () => {
      mockedGateway.deleteMealsByMealIdIngredientsByIngredientId.mockRejectedValue(new Error('Network error'));

      await expect(doRemoveMealIngredient(1, 2)).rejects.toThrow(McpError);
      await expect(doRemoveMealIngredient(1, 2)).rejects.toThrow('Backend error: Error: Network error');
    });
  });

  describe('registerRemoveMealIngredient', () => {
    it('should register tool with server', () => {
      const mockServer = {
        tool: jest.fn()
      } as unknown as McpServer;

      registerRemoveMealIngredient(mockServer);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'removeMealIngredient',
        'Remove an ingredient from a meal by ingredient ID. Use this to clean up ingredient lists or remove unwanted items from recipes.',
        { 
          mealId: removeMealIngredientArgs.shape.mealId,
          ingredientId: removeMealIngredientArgs.shape.ingredientId
        },
        expect.any(Function)
      );
    });

    it('should return formatted response from handler', async () => {
      const mockMeal = { id: 1, name: 'Test Meal', ingredients: [] };

      mockedGateway.deleteMealsByMealIdIngredientsByIngredientId.mockResolvedValue({
        data: { meal: mockMeal },
        error: null,
      } as any);

      const server = createMockServer();
      const mcpServer = server as unknown as McpServer;
      registerRemoveMealIngredient(mcpServer);

      const handler = server.registeredTools!['removeMealIngredient'].handler;
      const result = await handler({ mealId: 1, ingredientId: 2 });

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(mockMeal, null, 2) }]
      });
    });
  });
});