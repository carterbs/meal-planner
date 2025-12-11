/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unnecessary-condition */
import {
  Meal,
  MealPlan,
  MealPlanItem,
  MealPlanStatus,
  MealSlot,
  MealPlanEntry,
  Message,
  ShoppingListItem,
  Ingredient,
  Step,
} from '@mealplanner/generated';
import { MealPlanningCheckpointState } from '@mealplanner/generated';
import { MealPlanningState, MealPlanningStep } from '../shared/types';
import { Timestamp } from '@bufbuild/protobuf';
import {
  mealSlotFromString,
  mealSlotToString,
} from '../workflows/meal-planning/mealPlanUtils';

export class TestMockFactory {
  private static readonly DEFAULT_MEAL_PLAN_ID = 100;

  private static resolveMealSlot(value: MealSlot | string | undefined): MealSlot {
    if (value === undefined) {
      return MealSlot.DINNER;
    }
    return typeof value === 'string' ? mealSlotFromString(value) : value;
  }

  static createMockMeal(overrides: Partial<Meal> = {}): Meal {
    return new Meal({
      id: 1,
      name: 'Test Meal',
      effort: 2,
      hasRedMeat: false,
      lastPlanned: undefined,
      url: 'https://test.com',
      mealType: 'dinner',
      ingredients: [
        new Ingredient({
          id: 1,
          mealId: 1,
          quantity: 1,
          unit: 'cup',
          name: 'ingredient1',
        }),
        new Ingredient({
          id: 2,
          mealId: 1,
          quantity: 2,
          unit: 'tbsp',
          name: 'ingredient2',
        }),
      ],
      steps: [
        new Step({ id: 1, mealId: 1, stepNumber: 1, instruction: 'step1' }),
        new Step({ id: 2, mealId: 1, stepNumber: 2, instruction: 'step2' }),
      ],
      ...overrides,
    });
  }

  static createMockMealPlanItem(
    overrides: {
      id?: number;
      mealPlanId?: number;
      dayIndex?: number;
      mealType?: MealSlot | string;
      mealId?: number | null;
      mealSnapshot?: Meal | null;
      createdAt?: Timestamp;
      updatedAt?: Timestamp;
    } = {},
  ): MealPlanItem {
    const slot = this.resolveMealSlot(overrides.mealType);
    const snapshotExplicit = Object.prototype.hasOwnProperty.call(
      overrides,
      'mealSnapshot',
    );
    const mealSnapshot = snapshotExplicit
      ? overrides.mealSnapshot ?? null
      : overrides.mealId !== undefined
      ? this.createMockMeal({
          id: overrides.mealId ?? 0,
          mealType: mealSlotToString(slot),
        })
      : this.createMockMeal({ mealType: mealSlotToString(slot) });

    return new MealPlanItem({
      id: overrides.id ?? 1,
      mealPlanId: overrides.mealPlanId ?? this.DEFAULT_MEAL_PLAN_ID,
      dayIndex: overrides.dayIndex ?? 0,
      mealType: slot,
      mealId: overrides.mealId ?? mealSnapshot?.id ?? undefined,
      mealSnapshot: mealSnapshot ?? undefined,
      createdAt: overrides.createdAt,
      updatedAt: overrides.updatedAt,
    });
  }

  static createMockMealPlan(
    items: MealPlanItem[] = [],
    overrides: Partial<MealPlan> = {},
  ): MealPlan {
    return new MealPlan({
      id: overrides.id ?? 200,
      status: overrides.status ?? MealPlanStatus.DRAFT,
      version: overrides.version ?? 1,
      weekStartDate: overrides.weekStartDate,
      weekEndDate: overrides.weekEndDate,
      threadId: overrides.threadId,
      createdAt: overrides.createdAt,
      updatedAt: overrides.updatedAt,
      items: items.length > 0 ? items : [this.createMockMealPlanItem()],
    });
  }

  /** Temporary shim for legacy tests still constructing MealPlanEntry rows. */
  static createMockMealPlanEntry(
    overrides: Partial<MealPlanEntry> & { mealSnapshot?: Meal | null; mealId?: number | null } = {},
  ): MealPlanItem {
    const hasMealProp = Object.prototype.hasOwnProperty.call(overrides, 'meal');
    return this.createMockMealPlanItem({
      dayIndex: overrides.dayIndex ?? 0,
      mealType: overrides.mealType ?? 'dinner',
      mealSnapshot:
        hasMealProp
          ? ((overrides.meal as Meal | null | undefined) ?? null)
          : overrides.mealSnapshot ?? null,
      mealId:
        hasMealProp && overrides.meal && 'id' in overrides.meal
          ? overrides.meal.id ?? undefined
          : overrides.mealId,
    });
  }

  static createMockWeeklyMealPlan(
    entries: Array<MealPlanItem | MealPlanEntry> = [],
    overrides: Partial<MealPlan> = {},
  ): MealPlan {
    const items =
      entries.length > 0
        ? entries.map((entry, index) => {
            if (entry instanceof MealPlanItem) {
              return entry;
            }
            const meal =
              entry.meal ??
              this.createMockMeal({
                name: `Meal ${index + 1}`,
                mealType: entry.mealType ?? 'dinner',
              });
            return this.createMockMealPlanItem({
              dayIndex: entry.dayIndex ?? index,
              mealType: entry.mealType ?? 'dinner',
              mealSnapshot: meal,
              mealId: meal.id,
            });
          })
        : [this.createMockMealPlanItem()];
    return this.createMockMealPlan(items, overrides);
  }

  static createMockMealPlanningState(
    overrides: Partial<MealPlanningState> = {},
  ): MealPlanningState {
    return new MealPlanningCheckpointState({
      threadId: 'test-thread-123',
      participants: ['brad'],
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
      currentStep: MealPlanningStep.INITIATE,
      mealPlan: this.createMockWeeklyMealPlan(),
      feedbackHistory: [],
      iterationCount: 0,
      shoppingList: undefined,
      isFinalized: false,
      ...overrides,
    });
  }

  static createMockShoppingListItem(
    overrides: Partial<ShoppingListItem> = {},
  ): ShoppingListItem {
    return new ShoppingListItem({
      ingredient: 'Test Ingredient',
      quantity: '1 cup',
      category: 'Vegetables',
      ...overrides,
    });
  }

  static createMockMessage(overrides: Partial<Message> = {}): Message {
    return new Message({
      threadId: 'test-thread-123',
      sender: 'user',
      content: 'Test message',
      createdAt: new Date().toISOString(),
      ...overrides,
    });
  }

  static createMockMCPClient() {
    return {
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      callTool: jest.fn().mockResolvedValue({
        isError: false,
        content: [{ type: 'text', text: '{}' }],
      }),
    };
  }

  static createMockLLM() {
    return {
      invoke: jest.fn().mockResolvedValue({
        content: 'Mock LLM response',
      }),
    };
  }

  static createMockCheckpointer() {
    return {
      checkpointRepo: {
        getCheckpoint: jest.fn().mockResolvedValue({
          checkpoint: null,
          metadata: null,
          found: false,
        }),
        putCheckpoint: jest.fn().mockResolvedValue(undefined),
        listCheckpoints: jest.fn().mockResolvedValue([]),
        getWorkflowCheckpoint: jest
          .fn()
          .mockResolvedValue({ data: null, ns: null }),
        updateWorkflowCheckpoint: jest.fn().mockResolvedValue(undefined),
        listWorkflows: jest.fn().mockResolvedValue([]),
      },
      getTuple: jest.fn().mockResolvedValue(null),
      put: jest.fn().mockResolvedValue(undefined),
      list: jest.fn().mockResolvedValue([]),
      getWorkflowStatus: jest.fn().mockResolvedValue(null),
      listWorkflows: jest.fn().mockResolvedValue([]),
    };
  }

  static createMockBackendClient() {
    return {
      addMessage: jest.fn().mockResolvedValue(undefined),
      getMessages: jest.fn().mockResolvedValue({
        messages: [this.createMockMessage()],
      }),
    };
  }

  static createMockMessageRepository() {
    return {
      addMessage: jest.fn().mockResolvedValue(undefined),
      getMessages: jest.fn().mockResolvedValue([
        {
          sender: 'user',
          text: 'Test message',
          created_at: new Date().toISOString(),
        },
      ]),
      getMessagesForProtobuf: jest
        .fn()
        .mockResolvedValue([this.createMockMessage()]),
    };
  }

  static createMockExtendedRunnableConfig() {
    return {
      configurable: {
        threadId: 'test-thread-123',
      },
    };
  }

  static createHighEffortMeals(count: number): MealPlanItem[] {
    return Array.from({ length: count }, (_, i) =>
      this.createMockMealPlanItem({
        id: i + 1,
        dayIndex: i,
        mealType: MealSlot.DINNER,
        mealSnapshot: this.createMockMeal({
          id: i + 1,
          name: `High Effort Meal ${i + 1}`,
          effort: 4,
        }),
      }),
    );
  }

  static createRedMeatMeals(count: number): MealPlanItem[] {
    return Array.from({ length: count }, (_, i) =>
      this.createMockMealPlanItem({
        id: i + 1,
        dayIndex: i,
        mealType: MealSlot.DINNER,
        mealSnapshot: this.createMockMeal({
          id: i + 1,
          name: `Red Meat Meal ${i + 1}`,
          hasRedMeat: true,
        }),
      }),
    );
  }

  static createDuplicateMeals(): MealPlanItem[] {
    const duplicateMeal = this.createMockMeal({
      id: 1,
      name: 'Duplicate Meal',
    });
    return [
      this.createMockMealPlanItem({
        dayIndex: 0,
        mealType: MealSlot.BREAKFAST,
        mealSnapshot: duplicateMeal,
        mealId: duplicateMeal.id,
      }),
      this.createMockMealPlanItem({
        dayIndex: 1,
        mealType: MealSlot.LUNCH,
        mealSnapshot: duplicateMeal,
        mealId: duplicateMeal.id,
      }),
    ];
  }
}

export class TestAssertionHelpers {
  static assertMealPlanStructure(plan: MealPlan) {
    expect(plan).toBeInstanceOf(MealPlan);
    expect(Array.isArray(plan.items)).toBe(true);
  }

  static assertStateStructure(state: MealPlanningState) {
    expect(state).toBeInstanceOf(MealPlanningCheckpointState);
    expect(typeof state.threadId).toBe('string');
    expect(Array.isArray(state.participants)).toBe(true);
    expect(state.createdAt).toBeInstanceOf(Timestamp);
    expect(state.updatedAt).toBeInstanceOf(Timestamp);
    expect(Object.values(MealPlanningStep)).toContain(state.currentStep);
  }
}

export const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

export function setupConsoleMocks() {
  jest.spyOn(console, 'log').mockImplementation(mockConsole.log);
  jest.spyOn(console, 'error').mockImplementation(mockConsole.error);
  jest.spyOn(console, 'warn').mockImplementation(mockConsole.warn);
  jest.spyOn(console, 'info').mockImplementation(mockConsole.info);
}

export function restoreConsoleMocks() {
  jest.restoreAllMocks();
}
