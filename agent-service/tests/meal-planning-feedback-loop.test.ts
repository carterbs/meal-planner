import { MealPlanningWorkflow } from '../workflows/meal-planning';
import { DbCheckpointSaver } from '../shared/dbCheckpointer';
import {
  TestMockFactory,
  setupConsoleMocks,
  restoreConsoleMocks,
} from './test-utils';
// Mock external dependencies
jest.mock('../logging');
describe('MealPlanningWorkflow Feedback Loop Tests', () => {
  let workflow: any;
  let mockCheckpointer: jest.Mocked<DbCheckpointSaver>;
  let mockClient: any;
  let mockLLM: any;
  let mockNanoLLM: any;
  let mockMessageRepo: any;
  beforeEach(() => {
    setupConsoleMocks();
    mockCheckpointer = TestMockFactory.createMockCheckpointer() as any;
    mockClient = TestMockFactory.createMockMCPClient();
    mockLLM = TestMockFactory.createMockLLM();
    mockNanoLLM = TestMockFactory.createMockLLM();
    mockMessageRepo = TestMockFactory.createMockMessageRepository();
    workflow = new MealPlanningWorkflow(mockCheckpointer) as any;
    workflow.client = mockClient;
    workflow.llm = mockLLM;
    workflow.nanoLlm = mockNanoLLM;
    workflow.messageRepo = mockMessageRepo;
  });
  afterEach(() => {
    restoreConsoleMocks();
    jest.clearAllMocks();
  });
  describe('analyzeFeedbackNode', () => {
    it('analyzes feedback and detects satisfaction', async () => {
      const mockMessages = [
        TestMockFactory.createMockMessage({
          content: "This looks great, I'm happy with the plan!",
        }),
      ];
      mockNanoLLM.invoke.mockResolvedValue({
        content:
          '{"satisfied": true, "reasoning": "User expressed satisfaction"}',
      });
      const { analyzeFeedbackNode } = await import('../workflows/meal-planning/nodes/feedback/analyze.js');
      const result = await analyzeFeedbackNode(mockMessages as any, {
        nanoLlm: workflow.nanoLlm,
        extractJsonFromResponse: (s: string) => s,
      } as any);
      expect(result).toEqual({
        satisfied: true,
        reasoning: 'User expressed satisfaction',
      });
      expect(mockNanoLLM.invoke).toHaveBeenCalledWith([
        {
          role: 'user',
          content: expect.stringContaining(
            "This looks great, I'm happy with the plan!",
          ),
        },
      ]);
    });
    it('detects dissatisfaction in feedback', async () => {
      const mockMessages = [
        TestMockFactory.createMockMessage({
          content: "I don't like the meals for Monday",
        }),
      ];
      mockNanoLLM.invoke.mockResolvedValue({
        content:
          '{"satisfied": false, "reasoning": "User wants changes to Monday meals"}',
      });
      const { analyzeFeedbackNode: analyze2 } = await import('../workflows/meal-planning/nodes/feedback/analyze.js');
      const result = await analyze2(mockMessages as any, {
        nanoLlm: workflow.nanoLlm,
        extractJsonFromResponse: (s: string) => s,
      } as any);
      expect(result).toEqual({
        satisfied: false,
        reasoning: 'User wants changes to Monday meals',
      });
    });
    it('handles unparsable feedback analysis gracefully', async () => {
      const mockMessages = [
        TestMockFactory.createMockMessage({
          content: 'Some feedback',
        }),
      ];
      mockNanoLLM.invoke.mockResolvedValue({
        content: 'Not valid JSON',
      });
      const { analyzeFeedbackNode: analyze3 } = await import('../workflows/meal-planning/nodes/feedback/analyze.js');
      const result = await analyze3(mockMessages as any, {
        nanoLlm: workflow.nanoLlm,
        extractJsonFromResponse: (s: string) => s,
      } as any);
      expect(result).toEqual({
        satisfied: false,
        reasoning: 'Could not parse LLM response.',
      });
    });
  });
  describe('applyFeedbackNode', () => {
    it('applies feedback with meal replacements', async () => {
      const mockMealPlan = TestMockFactory.createMockWeeklyMealPlan();
      const mockState = TestMockFactory.createMockMealPlanningState({
        mealPlan: mockMealPlan,
        threadId: 'test-thread',
      });
      const mockFeedback = [
        TestMockFactory.createMockMessage({
          content: 'Please change dinner on Monday',
        }),
      ];
      const stateWithFeedback = {
        ...mockState,
        feedback_to_apply: mockFeedback,
      };
      // Mock MCP client for getMeals
      mockClient.callTool.mockResolvedValue({
        isError: false,
        content: [
          {
            type: 'text',
            text: JSON.stringify([TestMockFactory.createMockMeal()]),
          },
        ],
      });
      // Mock LLM response for feedback application
      mockLLM.invoke.mockResolvedValue({
        content: JSON.stringify({
          replacements: [
            {
              day: 'Monday',
              mealType: 'dinner',
              oldMealId: 1,
              newMealId: 2,
              reason: 'User requested change',
            },
          ],
          userMessage: "I've updated Monday dinner as requested!",
        }),
      });
      const { applyFeedbackNode } = await import('../workflows/meal-planning/nodes/feedback/apply.js');
      const result = await applyFeedbackNode(stateWithFeedback as any, {
        getMessages: async () => [],
        applyFeedbackWithLLM: (plan: any, messages: any[]) => workflow.applyFeedbackWithLLM(plan, messages),
        addMessage: (threadId: string, sender: string, message: string) => mockMessageRepo.addMessage(threadId, sender, message),
      } as any);
      expect(result.mealPlan).toBeDefined();
      expect(mockMessageRepo.addMessage).toHaveBeenCalledWith(
        'test-thread',
        'agent',
        "I've updated Monday dinner as requested!",
      );
    });
    it('applies feedback with meal removals', async () => {
      const mockMealPlan = TestMockFactory.createMockWeeklyMealPlan();
      const mockState = TestMockFactory.createMockMealPlanningState({
        mealPlan: mockMealPlan,
        threadId: 'test-thread',
      });
      const mockFeedback = [
        TestMockFactory.createMockMessage({
          content: 'Remove breakfast on Sunday',
        }),
      ];
      const stateWithFeedback = {
        ...mockState,
        feedback_to_apply: mockFeedback,
      };
      // Mock MCP client for getMeals
      mockClient.callTool.mockResolvedValue({
        isError: false,
        content: [
          {
            type: 'text',
            text: JSON.stringify([TestMockFactory.createMockMeal()]),
          },
        ],
      });
      // Mock LLM response for feedback application
      mockLLM.invoke.mockResolvedValue({
        content: JSON.stringify({
          removals: [
            {
              day: 'Sunday',
              mealType: 'breakfast',
              reason: 'User requested removal',
            },
          ],
          userMessage: "I've removed Sunday breakfast as requested!",
        }),
      });
      const { applyFeedbackNode: apply2 } = await import('../workflows/meal-planning/nodes/feedback/apply.js');
      const result = await apply2(stateWithFeedback as any, {
        getMessages: async () => [],
        applyFeedbackWithLLM: (plan: any, messages: any[]) => workflow.applyFeedbackWithLLM(plan, messages),
        addMessage: (threadId: string, sender: string, message: string) => mockMessageRepo.addMessage(threadId, sender, message),
      } as any);
      expect(result.mealPlan).toBeDefined();
    });
    it('handles feedback with invalid meal IDs', async () => {
      const mockMealPlan = TestMockFactory.createMockWeeklyMealPlan();
      const mockState = TestMockFactory.createMockMealPlanningState({
        mealPlan: mockMealPlan,
        threadId: 'test-thread',
      });
      const mockFeedback = [
        TestMockFactory.createMockMessage({
          content: 'Change dinner to something else',
        }),
      ];
      const stateWithFeedback = {
        ...mockState,
        feedback_to_apply: mockFeedback,
      };
      // Mock MCP client for getMeals
      mockClient.callTool.mockResolvedValue({
        isError: false,
        content: [
          {
            type: 'text',
            text: JSON.stringify([TestMockFactory.createMockMeal({ id: 1 })]),
          },
        ],
      });
      // Mock LLM response with invalid meal ID
      mockLLM.invoke.mockResolvedValue({
        content: JSON.stringify({
          replacements: [
            {
              day: 'Monday',
              mealType: 'dinner',
              oldMealId: 1,
              newMealId: 999, // Invalid ID
              reason: 'User requested change',
            },
          ],
          userMessage: "I've made some adjustments to your meal plan.",
        }),
      });
      const { applyFeedbackNode: apply3 } = await import('../workflows/meal-planning/nodes/feedback/apply.js');
      const result = await apply3(stateWithFeedback as any, {
        getMessages: async () => [],
        applyFeedbackWithLLM: (plan: any, messages: any[]) => workflow.applyFeedbackWithLLM(plan, messages),
        addMessage: (threadId: string, sender: string, message: string) => mockMessageRepo.addMessage(threadId, sender, message),
      } as any);
      expect(result.mealPlan).toBeDefined();
      // The meal plan should remain unchanged for invalid replacements
    });
    it('throws error when no meal plan to apply feedback to', async () => {
      const mockState = TestMockFactory.createMockMealPlanningState({
        mealPlan: undefined,
      });
      const mockFeedback = [
        TestMockFactory.createMockMessage({
          content: 'Some feedback',
        }),
      ];
      const stateWithFeedback = {
        ...mockState,
        feedback_to_apply: mockFeedback,
      };
      await expect(
        (await import('../workflows/meal-planning/nodes/feedback/apply.js')).applyFeedbackNode(stateWithFeedback as any, {
          getMessages: async () => [],
          applyFeedbackWithLLM: async () => {
            throw new Error('LLM error');
          },
          addMessage: (threadId: string, sender: string, message: string) => mockMessageRepo.addMessage(threadId, sender, message),
        } as any),
      ).rejects.toThrow('No meal plan to apply feedback to');
    });
  });
  describe('feedback loop integration', () => {
    it('applies feedback and updates meal plan', async () => {
      const mockMealPlan = TestMockFactory.createMockWeeklyMealPlan();
      const mockState = TestMockFactory.createMockMealPlanningState({
        mealPlan: mockMealPlan,
        threadId: 'test-thread',
      });
      const mockFeedback = [
        TestMockFactory.createMockMessage({
          content: 'Change Monday dinner to something lighter',
        }),
      ];
      const stateWithFeedback = {
        ...mockState,
        feedback_to_apply: mockFeedback,
      };
      // Mock MCP client for getMeals
      mockClient.callTool.mockResolvedValue({
        isError: false,
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              TestMockFactory.createMockMeal({ id: 1, name: 'Heavy Meal' }),
              TestMockFactory.createMockMeal({
                id: 2,
                name: 'Light Meal',
                effort: 1,
              }),
            ]),
          },
        ],
      });
      // Mock LLM for feedback application
      mockLLM.invoke.mockResolvedValue({
        content: JSON.stringify({
          replacements: [
            {
              day: 'Monday',
              mealType: 'dinner',
              oldMealId: 1,
              newMealId: 2,
              reason: 'User requested lighter meal',
            },
          ],
          userMessage: "I've changed Monday dinner to a lighter option!",
        }),
      });
      const { applyFeedbackNode: apply4 } = await import('../workflows/meal-planning/nodes/feedback/apply.js');
      const result = await apply4(stateWithFeedback as any, {
        getMessages: async () => [],
        applyFeedbackWithLLM: (plan: any, messages: any[]) => workflow.applyFeedbackWithLLM(plan, messages),
        addMessage: (threadId: string, sender: string, message: string) => mockMessageRepo.addMessage(threadId, sender, message),
      } as any);
      expect(result.mealPlan).toBeDefined();
      expect(mockMessageRepo.addMessage).toHaveBeenCalledWith(
        'test-thread',
        'agent',
        "I've changed Monday dinner to a lighter option!",
      );
    });
    it('handles feedback analysis for satisfied user', async () => {
      const mockFeedback = [
        TestMockFactory.createMockMessage({
          content: 'This meal plan looks perfect, thank you!',
        }),
      ];
      mockNanoLLM.invoke.mockResolvedValue({
        content:
          '{"satisfied": true, "reasoning": "User expressed satisfaction with the plan"}',
      });
      const { analyzeFeedbackNode: analyze4 } = await import('../workflows/meal-planning/nodes/feedback/analyze.js');
      const result = await analyze4(mockFeedback as any, {
        nanoLlm: workflow.nanoLlm,
        extractJsonFromResponse: (s: string) => s,
      } as any);
      expect(result.satisfied).toBe(true);
      expect(result.reasoning).toBe(
        'User expressed satisfaction with the plan',
      );
    });
    it('handles feedback analysis for dissatisfied user', async () => {
      const mockFeedback = [
        TestMockFactory.createMockMessage({
          content: 'I need more vegetarian options',
        }),
      ];
      mockNanoLLM.invoke.mockResolvedValue({
        content:
          '{"satisfied": false, "reasoning": "User wants more vegetarian options"}',
      });
      const { analyzeFeedbackNode: analyze5 } = await import('../workflows/meal-planning/nodes/feedback/analyze.js');
      const result = await analyze5(mockFeedback as any, {
        nanoLlm: workflow.nanoLlm,
        extractJsonFromResponse: (s: string) => s,
      } as any);
      expect(result.satisfied).toBe(false);
      expect(result.reasoning).toBe('User wants more vegetarian options');
    });
    it('handles feedback with complex meal changes', async () => {
      const mockMealPlan = TestMockFactory.createMockWeeklyMealPlan();
      const mockState = TestMockFactory.createMockMealPlanningState({
        mealPlan: mockMealPlan,
        threadId: 'test-thread',
      });
      const mockFeedback = [
        TestMockFactory.createMockMessage({
          content: 'Remove all breakfast meals and change Tuesday lunch',
        }),
      ];
      const stateWithFeedback = {
        ...mockState,
        feedback_to_apply: mockFeedback,
      };
      // Mock MCP client for getMeals
      mockClient.callTool.mockResolvedValue({
        isError: false,
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              TestMockFactory.createMockMeal({ id: 1, mealType: 'lunch' }),
              TestMockFactory.createMockMeal({ id: 2, mealType: 'lunch' }),
            ]),
          },
        ],
      });
      // Mock LLM for feedback application
      mockLLM.invoke.mockResolvedValue({
        content: JSON.stringify({
          removals: [
            {
              day: 'Monday',
              mealType: 'breakfast',
              reason: 'User requested no breakfast meals',
            },
          ],
          replacements: [
            {
              day: 'Tuesday',
              mealType: 'lunch',
              oldMealId: 1,
              newMealId: 2,
              reason: 'User requested different lunch',
            },
          ],
          userMessage:
            "I've removed breakfast meals and updated Tuesday lunch!",
        }),
      });
      const { applyFeedbackNode: apply5 } = await import('../workflows/meal-planning/nodes/feedback/apply.js');
      const result = await apply5(stateWithFeedback as any, {
        getMessages: async () => [],
        applyFeedbackWithLLM: (plan: any, messages: any[]) => workflow.applyFeedbackWithLLM(plan, messages),
        addMessage: (threadId: string, sender: string, message: string) => mockMessageRepo.addMessage(threadId, sender, message),
      } as any);
      expect(result.mealPlan).toBeDefined();
      expect(mockMessageRepo.addMessage).toHaveBeenCalledWith(
        'test-thread',
        'agent',
        "I've removed breakfast meals and updated Tuesday lunch!",
      );
    });
  });
});
