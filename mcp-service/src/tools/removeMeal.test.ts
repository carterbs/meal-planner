import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { doRemoveMeal, registerRemoveMeal, removeMealArgs } from './removeMeal.js';
import { McpError, McpServer } from '@modelcontextprotocol/sdk/types.js';
import type { WeeklyMealPlan } from '@mealplanner/generated';

describe('removeMeal tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('removeMealArgs schema', () => {
    it('should validate complete arguments', () => {
      const validArgs = {
        plan: { days: [] },
        dayIndex: 3,
        mealType: 'dinner' as const
      };
      const result = removeMealArgs.parse(validArgs);
      expect(result).toEqual(validArgs);
    });

    it('should validate all meal types', () => {
      const mealTypes = ['breakfast', 'lunch', 'dinner'] as const;
      mealTypes.forEach(mealType => {
        const args = { plan: {}, dayIndex: 0, mealType };
        expect(removeMealArgs.parse(args)).toEqual(args);
      });
    });

    it('should reject invalid meal types', () => {
      const invalidArgs = { plan: {}, dayIndex: 0, mealType: 'snack' };
      expect(() => removeMealArgs.parse(invalidArgs)).toThrow();
    });
  });

  describe('doRemoveMeal', () => {
    it('should remove meal successfully', () => {
      const plan: WeeklyMealPlan = {
        days: [
          {
            dayIndex: 0,
            mealType: 'dinner',
            meal: { id: 1, name: 'Test Meal', effort: 3, hasRedMeat: false, url: '', mealType: 'dinner', ingredients: [], steps: [], lastPlanned: undefined }
          }
        ],
        shoppingList: []
      };

      const result = doRemoveMeal(plan, 0, 'dinner');

      expect(result.days[0].meal).toBeUndefined();
      expect(plan.days[0].meal).toBeDefined(); // Original should not be mutated
    });

    it('should throw McpError for invalid dayIndex', () => {
      const plan: WeeklyMealPlan = { days: [], shoppingList: [] };

      expect(() => doRemoveMeal(plan, -1, 'dinner')).toThrow(McpError);
      expect(() => doRemoveMeal(plan, 7, 'dinner')).toThrow(McpError);
    });

    it('should throw McpError for invalid mealType', () => {
      const plan: WeeklyMealPlan = { days: [], shoppingList: [] };

      expect(() => doRemoveMeal(plan, 0, 'snack')).toThrow(McpError);
    });

    it('should throw McpError when meal not found', () => {
      const plan: WeeklyMealPlan = { days: [], shoppingList: [] };

      expect(() => doRemoveMeal(plan, 0, 'dinner')).toThrow(McpError);
      expect(() => doRemoveMeal(plan, 0, 'dinner')).toThrow('meal not found for specified dayIndex and mealType');
    });

    it('should throw McpError when meal already empty', () => {
      const plan: WeeklyMealPlan = {
        days: [
          { dayIndex: 0, mealType: 'dinner', meal: undefined as any }
        ],
        shoppingList: []
      };

      expect(() => doRemoveMeal(plan, 0, 'dinner')).toThrow(McpError);
      expect(() => doRemoveMeal(plan, 0, 'dinner')).toThrow('meal already empty');
    });

    it('should handle case insensitive meal types', () => {
      const plan: WeeklyMealPlan = {
        days: [
          {
            dayIndex: 2,
            mealType: 'lunch',
            meal: { id: 1, name: 'Lunch', effort: 2, hasRedMeat: false, url: '', mealType: 'lunch', ingredients: [], steps: [], lastPlanned: undefined }
          }
        ],
        shoppingList: []
      };

      const result = doRemoveMeal(plan, 2, 'LUNCH');
      expect(result.days[0].meal).toBeUndefined();
    });

    it('should throw McpError for null plan', () => {
      expect(() => doRemoveMeal(null as any, 0, 'dinner')).toThrow(McpError);
      expect(() => doRemoveMeal(null as any, 0, 'dinner')).toThrow('plan is null or undefined');
    });
  });

  describe('registerRemoveMeal', () => {
    it('should register tool with server', () => {
      const mockServer = {
        tool: jest.fn()
      };

      registerRemoveMeal(mockServer);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'removeMeal',
        'Remove a specific meal from the current meal plan session',
        {
          plan: removeMealArgs.shape.plan,
          dayIndex: removeMealArgs.shape.dayIndex,
          mealType: removeMealArgs.shape.mealType
        },
        expect.any(Function)
      );
    });

    it('should return formatted response from handler', async () => {
      const plan: WeeklyMealPlan = {
        days: [
          {
            dayIndex: 1,
            mealType: 'breakfast',
            meal: { id: 1, name: 'Breakfast', effort: 1, hasRedMeat: false, url: '', mealType: 'breakfast', ingredients: [], steps: [], lastPlanned: undefined }
          }
        ],
        shoppingList: []
      };

      const mockServer = {
        tool: jest.fn()
      };

      registerRemoveMeal(mockServer);

      const handler = (mockServer.tool as jest.MockedFunction<typeof handler>).mock.calls[0][3];
      const result = await handler({ plan, dayIndex: 1, mealType: 'breakfast' });

      expect(result.content[0].text).toContain('"days"');
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.days[0].meal).toBeUndefined();
    });
  });
});