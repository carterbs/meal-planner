import { WeeklyMealPlan, MealPlanEntry, Meal, ShoppingListItem, Message, Ingredient, Step } from '@mealplanner/generated';
import { MealPlanningCheckpointState } from '@mealplanner/generated';
import { MealPlanningState, MealPlanningStep } from '../shared/types';
import { Timestamp } from '@bufbuild/protobuf';

export class TestMockFactory {
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
        new Ingredient({ id: 1, mealId: 1, quantity: 1, unit: 'cup', name: 'ingredient1' }),
        new Ingredient({ id: 2, mealId: 1, quantity: 2, unit: 'tbsp', name: 'ingredient2' })
      ],
      steps: [
        new Step({ id: 1, mealId: 1, stepNumber: 1, instruction: 'step1' }),
        new Step({ id: 2, mealId: 1, stepNumber: 2, instruction: 'step2' })
      ],
      ...overrides,
    });
  }

  static createMockMealPlanEntry(overrides: Partial<MealPlanEntry> = {}): MealPlanEntry {
    return new MealPlanEntry({
      dayIndex: 0,
      mealType: 'dinner',
      meal: this.createMockMeal(),
      ...overrides,
    });
  }

  static createMockWeeklyMealPlan(entries: MealPlanEntry[] = []): WeeklyMealPlan {
    return new WeeklyMealPlan({
      days: entries.length > 0 ? entries : [this.createMockMealPlanEntry()],
      shoppingList: [],
    });
  }

  static createMockMealPlanningState(overrides: Partial<MealPlanningState> = {}): MealPlanningState {
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

  static createMockShoppingListItem(overrides: Partial<ShoppingListItem> = {}): ShoppingListItem {
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

  static createMockExtendedRunnableConfig() {
    return {
      configurable: {
        threadId: 'test-thread-123',
      },
    };
  }

  static createHighEffortMeals(count: number): MealPlanEntry[] {
    return Array.from({ length: count }, (_, i) =>
      this.createMockMealPlanEntry({
        dayIndex: i,
        mealType: 'dinner',
        meal: this.createMockMeal({
          id: i + 1,
          name: `High Effort Meal ${i + 1}`,
          effort: 4,
        }),
      })
    );
  }

  static createRedMeatMeals(count: number): MealPlanEntry[] {
    return Array.from({ length: count }, (_, i) =>
      this.createMockMealPlanEntry({
        dayIndex: i,
        mealType: 'dinner',
        meal: this.createMockMeal({
          id: i + 1,
          name: `Red Meat Meal ${i + 1}`,
          hasRedMeat: true,
        }),
      })
    );
  }

  static createDuplicateMeals(): MealPlanEntry[] {
    const duplicateMeal = this.createMockMeal({ id: 1, name: 'Duplicate Meal' });
    return [
      this.createMockMealPlanEntry({
        dayIndex: 0,
        mealType: 'breakfast',
        meal: duplicateMeal,
      }),
      this.createMockMealPlanEntry({
        dayIndex: 1,
        mealType: 'lunch',
        meal: duplicateMeal,
      }),
    ];
  }
}

export class TestAssertionHelpers {
  static assertMealPlanStructure(plan: WeeklyMealPlan) {
    expect(plan).toBeInstanceOf(WeeklyMealPlan);
    expect(plan.days).toBeDefined();
    expect(Array.isArray(plan.days)).toBe(true);
  }

  static assertMealPlanEntryStructure(entry: MealPlanEntry) {
    expect(entry).toBeInstanceOf(MealPlanEntry);
    expect(typeof entry.dayIndex).toBe('number');
    expect(typeof entry.mealType).toBe('string');
    expect(entry.dayIndex).toBeGreaterThanOrEqual(0);
    expect(entry.dayIndex).toBeLessThanOrEqual(6);
    expect(['breakfast', 'lunch', 'dinner']).toContain(entry.mealType);
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