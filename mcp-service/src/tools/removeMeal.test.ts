import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { doRemoveMeal, registerRemoveMeal, removeMealArgs } from './removeMeal.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  Meal,
  MealPlan,
  MealPlanItem,
  MealPlanStatus,
  MealSlot,
} from '@mealplanner/generated';

function createMeal(overrides: Partial<Meal> = {}): Meal {
  return new Meal({
    id: 1,
    name: 'Test Meal',
    effort: 2,
    hasRedMeat: false,
    url: '',
    mealType: 'dinner',
    ingredients: [],
    steps: [],
    ...overrides,
  });
}

function createItem(overrides: Partial<MealPlanItem> = {}): MealPlanItem {
  return new MealPlanItem({
    id: 10,
    dayIndex: 0,
    mealType: MealSlot.DINNER,
    mealSnapshot: createMeal(),
    ...overrides,
  });
}

function createPlan(overrides: Partial<MealPlan> = {}): MealPlan {
  return new MealPlan({
    id: 100,
    status: MealPlanStatus.DRAFT,
    version: 1,
    items: [createItem()],
    ...overrides,
  });
}

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
        plan: { items: [] },
        dayIndex: 3,
        mealType: 'dinner' as const,
      };
      const result = removeMealArgs.parse(validArgs);
      expect(result).toEqual(validArgs);
    });

    it('should validate all meal types', () => {
      (['breakfast', 'lunch', 'dinner'] as const).forEach((mealType) => {
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
      const plan = createPlan();

      const result = doRemoveMeal(plan, 0, 'dinner');

      expect(result.items[0].mealSnapshot).toBeUndefined();
      expect(plan.items[0].mealSnapshot).toBeInstanceOf(Meal); // original untouched
    });

    it('should throw McpError for invalid dayIndex', () => {
      const plan = createPlan();

      expect(() => doRemoveMeal(plan, -1, 'dinner')).toThrow(McpError);
      expect(() => doRemoveMeal(plan, 7, 'dinner')).toThrow(McpError);
    });

    it('should throw McpError for invalid mealType', () => {
      const plan = createPlan();

      expect(() => doRemoveMeal(plan, 0, 'snack')).toThrow(McpError);
    });

    it('should throw McpError when meal not found', () => {
      const plan = createPlan({
        items: [
          createItem({ dayIndex: 1, mealType: MealSlot.BREAKFAST }),
        ],
      });

      expect(() => doRemoveMeal(plan, 0, 'dinner')).toThrow(McpError);
      expect(() => doRemoveMeal(plan, 0, 'dinner')).toThrow(
        'meal not found for specified dayIndex and mealType',
      );
    });

    it('should throw McpError when meal already empty', () => {
      const plan = createPlan({
        items: [
          createItem({
            mealSnapshot: undefined,
            mealId: undefined,
          }),
        ],
      });

      expect(() => doRemoveMeal(plan, 0, 'dinner')).toThrow(McpError);
      expect(() => doRemoveMeal(plan, 0, 'dinner')).toThrow('meal already empty');
    });

    it('should handle case insensitive meal types', () => {
      const plan = createPlan({
        items: [
          createItem({
            dayIndex: 2,
            mealType: MealSlot.LUNCH,
            mealSnapshot: createMeal({ mealType: 'lunch', name: 'Lunch' }),
          }),
        ],
      });

      const result = doRemoveMeal(plan, 2, 'LUNCH');
      expect(result.items[0].mealSnapshot).toBeUndefined();
    });

    it('should throw McpError for null plan', () => {
      expect(() => doRemoveMeal(null as any, 0, 'dinner')).toThrow(McpError);
      expect(() => doRemoveMeal(null as any, 0, 'dinner')).toThrow(
        'plan is null or undefined',
      );
    });
  });

  describe('registerRemoveMeal', () => {
    it('should register tool with server', () => {
      const mockServer = {
        tool: jest.fn(),
      } as unknown as McpServer;

      registerRemoveMeal(mockServer);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'removeMeal',
        'Remove a specific meal from the current meal plan session',
        {
          plan: removeMealArgs.shape.plan,
          dayIndex: removeMealArgs.shape.dayIndex,
          mealType: removeMealArgs.shape.mealType,
        },
        expect.any(Function),
      );
    });

    it('should return formatted response from handler', async () => {
      const plan = createPlan({
        items: [
          createItem({
            dayIndex: 1,
            mealType: MealSlot.BREAKFAST,
            mealSnapshot: createMeal({ mealType: 'breakfast', name: 'Breakfast' }),
          }),
        ],
      });

      const mockServer = {
        tool: jest.fn(),
      } as unknown as McpServer;

      registerRemoveMeal(mockServer);

      const handler = (mockServer.tool as jest.Mock).mock.calls[0][3] as (args: {
        plan: MealPlan;
        dayIndex: number;
        mealType: string;
      }) => Promise<{ content: Array<{ type: string; text: string }> }>;
      const result = await handler({ plan, dayIndex: 1, mealType: 'breakfast' });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.items[0].mealSnapshot).toBeUndefined();
    });
  });
});
