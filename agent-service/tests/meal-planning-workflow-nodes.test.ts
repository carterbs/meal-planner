import { MealPlanningWorkflow } from '../workflows/meal-planning';
import { MealPlanningStep } from '../shared/types';
import { ShoppingList } from '@mealplanner/generated';
import { DbCheckpointSaver } from '../shared/dbCheckpointer';
import {
  TestMockFactory,
  TestAssertionHelpers,
  setupConsoleMocks,
  restoreConsoleMocks,
} from './test-utils';
// Mock external dependencies
jest.mock('../logging');
describe('MealPlanningWorkflow Core Node Tests', () => {
  let workflow: any;
  let mockCheckpointer: jest.Mocked<DbCheckpointSaver>;
  let mockClient: any;
  let mockLLM: any;
  let mockNanoLLM: any;
  beforeEach(() => {
    setupConsoleMocks();
    mockCheckpointer = TestMockFactory.createMockCheckpointer() as any;
    mockClient = TestMockFactory.createMockMCPClient();
    mockLLM = TestMockFactory.createMockLLM();
    mockNanoLLM = TestMockFactory.createMockLLM();
    workflow = new MealPlanningWorkflow(mockCheckpointer) as any;
    workflow.client = mockClient;
    workflow.llm = mockLLM;
    workflow.nanoLlm = mockNanoLLM;
  });
  afterEach(() => {
    restoreConsoleMocks();
    jest.clearAllMocks();
  });
  describe('initiateNode', () => {
    it('initiates workflow with correct initial state', async () => {
      const mockState = TestMockFactory.createMockMealPlanningState({
        currentStep: MealPlanningStep.INITIATE,
      });
      const { initiateNode } = await import('../workflows/meal-planning/nodes/initiate.js');
      const result = await initiateNode(mockState);
      expect(result).toEqual({
        currentStep: MealPlanningStep.GENERATE_PLAN,
      });
    });
  });
  describe('generatePlanNode', () => {
    it('generates meal plan from MCP tool successfully', async () => {
      const mockState = TestMockFactory.createMockMealPlanningState({
        currentStep: MealPlanningStep.GENERATE_PLAN,
      });
      const mockPlan = TestMockFactory.createMockWeeklyMealPlan();
      mockClient.callTool.mockResolvedValue({
        isError: false,
        content: [
          { type: 'text', text: JSON.stringify({ plan: mockPlan.toJson() }) },
        ],
      });
      const { generatePlanNode } = await import('../workflows/meal-planning/nodes/generatePlan.js');
      const result = await generatePlanNode(mockState as any, {
        callTool: (args: any) => mockClient.callTool(args),
        extractJsonFromResponse: (s: string) => s,
      } as any);
      expect(mockClient.callTool).toHaveBeenCalledWith({
        name: 'generateMealPlan',
        arguments: {},
      });
      expect(result.currentStep).toBe(MealPlanningStep.OPTIMIZE_PLAN);
      expect(result.mealPlan).toBeDefined();
      TestAssertionHelpers.assertMealPlanStructure(result.mealPlan as any);
    });
    it('handles MCP tool errors during plan generation', async () => {
      const mockState = TestMockFactory.createMockMealPlanningState({
        currentStep: MealPlanningStep.GENERATE_PLAN,
      });
      mockClient.callTool.mockResolvedValue({
        isError: true,
        content: [{ type: 'text', text: 'MCP tool error' }],
      });
      const { generatePlanNode: gen2 } = await import('../workflows/meal-planning/nodes/generatePlan.js');
      await expect(gen2(mockState, {
        callTool: async () => ({ isError: true, content: [{ type: 'text', text: 'MCP tool error' }] }),
        extractJsonFromResponse: (s: string) => s,
      } as any)).rejects.toThrow(
        'MCP tool error: MCP tool error',
      );
    });
  });
  describe('presentPlanNode', () => {
    it('presents plan with formatted output', async () => {
      const mockMealPlan = TestMockFactory.createMockWeeklyMealPlan();
      const mockState = TestMockFactory.createMockMealPlanningState({
        currentStep: MealPlanningStep.PRESENT_PLAN,
        mealPlan: mockMealPlan,
      });
      const { presentPlanNode } = await import('../workflows/meal-planning/nodes/presentPlan.js');
      const result = await presentPlanNode(mockState);
      expect(result).toEqual({
        currentStep: MealPlanningStep.AWAIT_FEEDBACK,
      });
    });
    it('throws error when no meal plan to present', async () => {
      const mockState = TestMockFactory.createMockMealPlanningState({
        currentStep: MealPlanningStep.PRESENT_PLAN,
        mealPlan: undefined,
      });
      const { presentPlanNode: present2 } = await import('../workflows/meal-planning/nodes/presentPlan.js');
      await expect(present2(mockState)).rejects.toThrow(
        'No meal plan to present',
      );
    });
  });
  describe('finalizePlanNode', () => {
    it('finalizes plan by calling MCP tool with threadId', async () => {
      const mockMealPlan = TestMockFactory.createMockWeeklyMealPlan();
      const mockState = TestMockFactory.createMockMealPlanningState({
        currentStep: MealPlanningStep.FINALIZE_PLAN,
        mealPlan: mockMealPlan,
        threadId: 'test-thread-123',
      });
      mockClient.callTool.mockResolvedValue({
        isError: false,
        content: [{ type: 'text', text: 'success' }],
      });
      const result = await workflow.finalizePlanNode(mockState);
      expect(mockClient.callTool).toHaveBeenCalledWith({
        name: 'finalizeMealPlan',
        arguments: { threadId: 'test-thread-123' },
      });
      expect(result.currentStep).toBe(MealPlanningStep.GENERATE_SHOPPING_LIST);
      expect(result.isFinalized).toBe(true);
    });
    it('throws critical error when MCP tool fails', async () => {
      const mockMealPlan = TestMockFactory.createMockWeeklyMealPlan();
      const mockState = TestMockFactory.createMockMealPlanningState({
        currentStep: MealPlanningStep.FINALIZE_PLAN,
        mealPlan: mockMealPlan,
        threadId: 'test-thread-123',
      });
      mockClient.callTool.mockRejectedValue(
        new Error('MCP finalization failed'),
      );
      await expect(workflow.finalizePlanNode(mockState)).rejects.toThrow(
        'Critical failure: Could not save meal plan: Error: MCP finalization failed',
      );
    });
    it('throws error when no thread ID available', async () => {
      const mockMealPlan = TestMockFactory.createMockWeeklyMealPlan();
      const mockState = TestMockFactory.createMockMealPlanningState({
        currentStep: MealPlanningStep.FINALIZE_PLAN,
        mealPlan: mockMealPlan,
        threadId: undefined,
      });
      await expect(workflow.finalizePlanNode(mockState)).rejects.toThrow(
        'No thread ID available for finalization',
      );
    });
    it('throws error when no meal plan to finalize', async () => {
      const mockState = TestMockFactory.createMockMealPlanningState({
        currentStep: MealPlanningStep.FINALIZE_PLAN,
        mealPlan: undefined,
        threadId: 'test-thread-123',
      });
      await expect(workflow.finalizePlanNode(mockState)).rejects.toThrow(
        'No meal plan to finalize',
      );
    });
  });
  describe('generateShoppingListNode', () => {
    it('generates shopping list from meal plan', async () => {
      const mockMealPlan = TestMockFactory.createMockWeeklyMealPlan([
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: 0,
          meal: TestMockFactory.createMockMeal({ id: 1 }),
        }),
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: 1,
          meal: TestMockFactory.createMockMeal({ id: 2 }),
        }),
      ]);
      const mockState = TestMockFactory.createMockMealPlanningState({
        currentStep: MealPlanningStep.GENERATE_SHOPPING_LIST,
        mealPlan: mockMealPlan,
      });
      const mockShoppingList = [
        TestMockFactory.createMockShoppingListItem({
          ingredient: 'Tomatoes',
          category: 'Vegetables',
        }),
        TestMockFactory.createMockShoppingListItem({
          ingredient: 'Chicken',
          category: 'Meat',
        }),
      ];
      mockClient.callTool.mockResolvedValue({
        isError: false,
        content: [{ type: 'text', text: JSON.stringify(mockShoppingList) }],
      });
      const result = await workflow.generateShoppingListNode(mockState);
      expect(mockClient.callTool).toHaveBeenCalledWith({
        name: 'generateShoppingList',
        arguments: { plan: [1, 2] },
      });
      expect(result.currentStep).toBe(MealPlanningStep.COMPLETE);
      expect(result.shoppingList).toBeInstanceOf(ShoppingList);
    });
    it('handles empty shopping list gracefully', async () => {
      const mockMealPlan = TestMockFactory.createMockWeeklyMealPlan([]);
      const mockState = TestMockFactory.createMockMealPlanningState({
        currentStep: MealPlanningStep.GENERATE_SHOPPING_LIST,
        mealPlan: mockMealPlan,
      });
      mockClient.callTool.mockResolvedValue({
        isError: false,
        content: [{ type: 'text', text: '[]' }],
      });
      const result = await workflow.generateShoppingListNode(mockState);
      expect(result.currentStep).toBe(MealPlanningStep.COMPLETE);
      expect(result.shoppingList).toBeUndefined();
    });
    it('handles MCP tool errors during shopping list generation', async () => {
      const mockMealPlan = TestMockFactory.createMockWeeklyMealPlan();
      const mockState = TestMockFactory.createMockMealPlanningState({
        currentStep: MealPlanningStep.GENERATE_SHOPPING_LIST,
        mealPlan: mockMealPlan,
      });
      mockClient.callTool.mockRejectedValue(
        new Error('Shopping list generation failed'),
      );
      const result = await workflow.generateShoppingListNode(mockState);
      // Should continue with empty shopping list on error
      expect(result.currentStep).toBe(MealPlanningStep.COMPLETE);
      expect(result.shoppingList).toBeUndefined();
    });
    it('throws error when no meal plan for shopping list generation', async () => {
      const mockState = TestMockFactory.createMockMealPlanningState({
        currentStep: MealPlanningStep.GENERATE_SHOPPING_LIST,
        mealPlan: undefined,
      });
      await expect(
        workflow.generateShoppingListNode(mockState),
      ).rejects.toThrow('No meal plan for shopping list generation');
    });
  });
  describe('completeNode', () => {
    it('completes workflow with final validation', async () => {
      const mockMealPlan = TestMockFactory.createMockWeeklyMealPlan();
      const mockState = TestMockFactory.createMockMealPlanningState({
        currentStep: MealPlanningStep.COMPLETE,
        mealPlan: mockMealPlan,
      });
      const result = await workflow.completeNode(mockState);
      expect(result).toEqual({
        currentStep: MealPlanningStep.COMPLETE,
      });
    });
    it('handles completion with validation issues', async () => {
      // Create a meal plan with validation issues
      const problemMealPlan = TestMockFactory.createMockWeeklyMealPlan(
        TestMockFactory.createHighEffortMeals(4),
      );
      const mockState = TestMockFactory.createMockMealPlanningState({
        currentStep: MealPlanningStep.COMPLETE,
        mealPlan: problemMealPlan,
      });
      const result = await workflow.completeNode(mockState);
      expect(result).toEqual({
        currentStep: MealPlanningStep.COMPLETE,
      });
    });
    it('handles completion with no meal plan', async () => {
      const mockState = TestMockFactory.createMockMealPlanningState({
        currentStep: MealPlanningStep.COMPLETE,
        mealPlan: undefined,
      });
      const result = await workflow.completeNode(mockState);
      expect(result).toEqual({
        currentStep: MealPlanningStep.COMPLETE,
      });
    });
  });
});
