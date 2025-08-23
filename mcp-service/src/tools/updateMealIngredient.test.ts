import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { doUpdateMealIngredient, registerUpdateMealIngredient, updateMealIngredientArgs } from './updateMealIngredient.js';
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

describe('updateMealIngredient tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('updateMealIngredientArgs schema', () => {
    it('should validate valid input with partial ingredient update', () => {
      const input = {
        mealId: 1,
        ingredientId: 2,
        ingredient: { name: 'updated tomatoes' }
      };
      expect(updateMealIngredientArgs.parse(input)).toEqual(input);
    });

    it('should validate valid input with full ingredient update', () => {
      const input = {
        mealId: 1,
        ingredientId: 2,
        ingredient: { name: 'tomatoes', quantity: 3, unit: 'pieces' }
      };
      expect(updateMealIngredientArgs.parse(input)).toEqual(input);
    });

    it('should validate valid input with empty ingredient update', () => {
      const input = {
        mealId: 1,
        ingredientId: 2,
        ingredient: {}
      };
      expect(updateMealIngredientArgs.parse(input)).toEqual(input);
    });

    it('should reject invalid meal ID', () => {
      expect(() => updateMealIngredientArgs.parse({ 
        mealId: 0, 
        ingredientId: 1, 
        ingredient: {} 
      })).toThrow();
    });

    it('should reject invalid ingredient ID', () => {
      expect(() => updateMealIngredientArgs.parse({ 
        mealId: 1, 
        ingredientId: 0, 
        ingredient: {} 
      })).toThrow();
    });

    it('should reject invalid quantity type', () => {
      expect(() => updateMealIngredientArgs.parse({ 
        mealId: 1, 
        ingredientId: 2, 
        ingredient: { quantity: 'invalid' } 
      })).toThrow();
    });
  });

  describe('doUpdateMealIngredient', () => {
    const mockUpdatedMeal = {
      id: 1,
      name: 'Test Meal',
      effort: 3,
      hasRedMeat: false,
      ingredients: [
        { id: 2, mealId: 1, name: 'updated tomatoes', quantity: 3, unit: 'pieces' }
      ]
    };

    it('should update ingredient successfully with partial data', async () => {
      mockedGateway.putMealsByMealIdIngredientsByIngredientId.mockResolvedValue({
        data: { meal: mockUpdatedMeal },
        error: null,
      } as any);

      const ingredientUpdate = { name: 'updated tomatoes', quantity: 3 };
      const result = await doUpdateMealIngredient(1, 2, ingredientUpdate);

      expect(mockedGateway.putMealsByMealIdIngredientsByIngredientId).toHaveBeenCalledWith({
        client: expect.any(String),
        path: { mealId: '1', ingredientId: '2' },
        body: {
          mealId: 1,
          ingredientId: 2,
          ingredient: {
            id: 2,
            mealId: 1,
            name: 'updated tomatoes',
            quantity: 3,
            unit: ''
          }
        }
      });
      expect(result).toEqual(mockUpdatedMeal);
    });

    it('should update ingredient successfully with full data', async () => {
      mockedGateway.putMealsByMealIdIngredientsByIngredientId.mockResolvedValue({
        data: { meal: mockUpdatedMeal },
        error: null,
      } as any);

      const ingredientUpdate = { name: 'new tomatoes', quantity: 5, unit: 'lbs' };
      const result = await doUpdateMealIngredient(1, 2, ingredientUpdate);

      expect(mockedGateway.putMealsByMealIdIngredientsByIngredientId).toHaveBeenCalledWith({
        client: expect.any(String),
        path: { mealId: '1', ingredientId: '2' },
        body: {
          mealId: 1,
          ingredientId: 2,
          ingredient: {
            id: 2,
            mealId: 1,
            name: 'new tomatoes',
            quantity: 5,
            unit: 'lbs'
          }
        }
      });
      expect(result).toEqual(mockUpdatedMeal);
    });

    it('should handle empty ingredient update', async () => {
      mockedGateway.putMealsByMealIdIngredientsByIngredientId.mockResolvedValue({
        data: { meal: mockUpdatedMeal },
        error: null,
      } as any);

      const result = await doUpdateMealIngredient(1, 2, {});

      expect(mockedGateway.putMealsByMealIdIngredientsByIngredientId).toHaveBeenCalledWith({
        client: expect.any(String),
        path: { mealId: '1', ingredientId: '2' },
        body: {
          mealId: 1,
          ingredientId: 2,
          ingredient: {
            id: 2,
            mealId: 1,
            name: '',
            quantity: 0,
            unit: ''
          }
        }
      });
      expect(result).toEqual(mockUpdatedMeal);
    });

    it('should throw McpError when no meal returned', async () => {
      mockedGateway.putMealsByMealIdIngredientsByIngredientId.mockResolvedValue({
        data: {},
        error: null,
      } as any);

      await expect(doUpdateMealIngredient(1, 2, { name: 'test' })).rejects.toThrow(McpError);
      await expect(doUpdateMealIngredient(1, 2, { name: 'test' })).rejects.toThrow('No meal returned from update ingredient request');
    });

    it('should throw McpError when API returns error', async () => {
      mockedGateway.putMealsByMealIdIngredientsByIngredientId.mockResolvedValue({
        data: null,
        error: 'Update failed',
      } as any);

      await expect(doUpdateMealIngredient(1, 2, { name: 'test' })).rejects.toThrow(McpError);
      await expect(doUpdateMealIngredient(1, 2, { name: 'test' })).rejects.toThrow('Backend error: Update failed');
    });

    it('should throw McpError when API call throws', async () => {
      mockedGateway.putMealsByMealIdIngredientsByIngredientId.mockRejectedValue(new Error('Network error'));

      await expect(doUpdateMealIngredient(1, 2, { name: 'test' })).rejects.toThrow(McpError);
      await expect(doUpdateMealIngredient(1, 2, { name: 'test' })).rejects.toThrow('Backend error: Error: Network error');
    });
  });

  describe('registerUpdateMealIngredient', () => {
    it('should register tool with server', () => {
      const mockServer = {
        tool: jest.fn()
      } as unknown as McpServer;

      registerUpdateMealIngredient(mockServer);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'updateMealIngredient',
        'Update an existing ingredient in a meal with new quantity, unit, or name. Allows precise modification of recipe ingredients.',
        { 
          mealId: updateMealIngredientArgs.shape.mealId,
          ingredientId: updateMealIngredientArgs.shape.ingredientId,
          ingredient: updateMealIngredientArgs.shape.ingredient
        },
        expect.any(Function)
      );
    });

    it('should return formatted response from handler', async () => {
      const mockMeal = { id: 1, name: 'Test Meal' };

      mockedGateway.putMealsByMealIdIngredientsByIngredientId.mockResolvedValue({
        data: { meal: mockMeal },
        error: null,
      } as any);

      const server = createMockServer();
      const mcpServer = server as unknown as McpServer;
      registerUpdateMealIngredient(mcpServer);

      const handler = server.registeredTools!['updateMealIngredient'].handler;
      const result = await handler({ 
        mealId: 1, 
        ingredientId: 2, 
        ingredient: { name: 'updated' } 
      });

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(mockMeal, null, 2) }]
      });
    });
  });
});