import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { doAddMealIngredient, registerAddMealIngredient, addMealIngredientArgs } from './addMealIngredient.js';
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

describe('addMealIngredient tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('addMealIngredientArgs schema', () => {
    const validIngredient = {
      name: 'tomatoes',
      quantity: 2,
      unit: 'cups'
    };

    it('should validate valid input', () => {
      const input = {
        mealId: 1,
        ingredient: validIngredient
      };
      expect(addMealIngredientArgs.parse(input)).toEqual(input);
    });

    it('should reject invalid meal ID', () => {
      expect(() => addMealIngredientArgs.parse({ mealId: 0, ingredient: validIngredient })).toThrow();
      expect(() => addMealIngredientArgs.parse({ mealId: -1, ingredient: validIngredient })).toThrow();
    });

    it('should reject invalid ingredient', () => {
      expect(() => addMealIngredientArgs.parse({ 
        mealId: 1, 
        ingredient: { name: '', quantity: 2, unit: 'cups' } 
      })).toThrow();
      
      expect(() => addMealIngredientArgs.parse({ 
        mealId: 1, 
        ingredient: { name: 'tomatoes', quantity: 'invalid', unit: 'cups' } 
      })).toThrow();
      
      expect(() => addMealIngredientArgs.parse({ 
        mealId: 1, 
        ingredient: { name: 'tomatoes', quantity: 2 } 
      })).toThrow();
    });
  });

  describe('doAddMealIngredient', () => {
    const mockIngredient = {
      name: 'tomatoes',
      quantity: 2,
      unit: 'cups'
    };

    const mockUpdatedMeal = {
      id: 1,
      name: 'Test Meal',
      effort: 3,
      hasRedMeat: false,
      ingredients: [
        { id: 1, mealId: 1, name: 'tomatoes', quantity: 2, unit: 'cups' }
      ]
    };

    it('should add ingredient to meal successfully', async () => {
      mockedGateway.postMealsByMealIdIngredients.mockResolvedValue({
        data: { meal: mockUpdatedMeal },
        error: null,
      } as any);

      const result = await doAddMealIngredient(1, mockIngredient);

      expect(mockedGateway.postMealsByMealIdIngredients).toHaveBeenCalledWith({
        client: expect.any(String),
        path: { mealId: '1' },
        body: {
          mealId: 1,
          ingredient: {
            id: 0,
            mealId: 1,
            name: 'tomatoes',
            quantity: 2,
            unit: 'cups'
          }
        }
      });
      expect(result).toEqual(mockUpdatedMeal);
    });

    it('should throw McpError when no meal returned', async () => {
      mockedGateway.postMealsByMealIdIngredients.mockResolvedValue({
        data: {},
        error: null,
      } as any);

      await expect(doAddMealIngredient(1, mockIngredient)).rejects.toThrow(McpError);
      await expect(doAddMealIngredient(1, mockIngredient)).rejects.toThrow('No meal returned from add ingredient request');
    });

    it('should throw McpError when API returns error', async () => {
      mockedGateway.postMealsByMealIdIngredients.mockResolvedValue({
        data: null,
        error: 'Creation failed',
      } as any);

      await expect(doAddMealIngredient(1, mockIngredient)).rejects.toThrow(McpError);
      await expect(doAddMealIngredient(1, mockIngredient)).rejects.toThrow('Backend error: Creation failed');
    });

    it('should throw McpError when API call throws', async () => {
      mockedGateway.postMealsByMealIdIngredients.mockRejectedValue(new Error('Network error'));

      await expect(doAddMealIngredient(1, mockIngredient)).rejects.toThrow(McpError);
      await expect(doAddMealIngredient(1, mockIngredient)).rejects.toThrow('Backend error: Error: Network error');
    });
  });

  describe('registerAddMealIngredient', () => {
    it('should register tool with server', () => {
      const mockServer = {
        tool: jest.fn()
      } as unknown as McpServer;

      registerAddMealIngredient(mockServer);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'addMealIngredient',
        'Add a new ingredient to an existing meal with specified quantity and unit. Essential for building complete recipe ingredient lists.',
        { 
          mealId: addMealIngredientArgs.shape.mealId,
          ingredient: addMealIngredientArgs.shape.ingredient
        },
        expect.any(Function)
      );
    });

    it('should return formatted response from handler', async () => {
      const mockMeal = { id: 1, name: 'Test Meal' };
      const mockIngredient = { name: 'tomatoes', quantity: 2, unit: 'cups' };

      mockedGateway.postMealsByMealIdIngredients.mockResolvedValue({
        data: { meal: mockMeal },
        error: null,
      } as any);

      const server = createMockServer();
      const mcpServer = server as unknown as McpServer;
      registerAddMealIngredient(mcpServer);

      const handler = server.registeredTools!['addMealIngredient'].handler;
      const result = await handler({ mealId: 1, ingredient: mockIngredient });

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(mockMeal, null, 2) }]
      });
    });
  });
});