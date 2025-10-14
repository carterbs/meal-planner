import { MealPlanningWorkflow } from '../workflows/meal-planning';
import { MealPlanningStep } from '../shared/types';
import { MealSlot } from '@mealplanner/generated';
import { TestMockFactory } from './test-utils';
import { DbCheckpointSaver } from '../shared/dbCheckpointer';
describe('MealPlanningWorkflow LLM integration and edge cases', () => {
  let workflow: any;
  const mockCheckpointer = {} as DbCheckpointSaver;
  beforeAll(() => {
    workflow = new MealPlanningWorkflow(mockCheckpointer) as any;
  });
  describe('analyzeFeedbackNode', () => {
    it('parses satisfied JSON response', async () => {
      workflow.nanoLlm = {
        invoke: jest.fn().mockResolvedValue({
          content: '```json\n{"satisfied":true,"reasoning":"Great"}\n```',
        }),
      };
      const feedback = [
        { message: 'looks good', timestamp: new Date().toISOString() },
      ];
      const { analyzeFeedbackNode } = await import('../workflows/meal-planning/nodes/feedback/analyze.js');
      const res = await analyzeFeedbackNode(feedback as any, {
        nanoLlm: workflow.nanoLlm,
        extractJsonFromResponse: (s: string) => s.replace(/```json|```/g, ''),
      } as any);
      expect(res).toEqual({ satisfied: true, reasoning: 'Great' });
    });
    it('handles unparsable JSON gracefully', async () => {
      workflow.nanoLlm = {
        invoke: jest.fn().mockResolvedValue({ content: 'not json' }),
      };
      const feedback = [
        { message: 'meh', timestamp: new Date().toISOString() },
      ];
      const spy = jest.spyOn(console, 'error').mockImplementation(() => { });
      const { analyzeFeedbackNode: analyze2 } = await import('../workflows/meal-planning/nodes/feedback/analyze.js');
      const res = await analyze2(feedback as any, {
        nanoLlm: workflow.nanoLlm,
        extractJsonFromResponse: (s: string) => s,
      } as any);
      expect(res).toHaveProperty('satisfied', false);
      spy.mockRestore();
    });
  });
  describe('applyFeedbackWithLLM', () => {
    beforeEach(() => {
      // Mocks for availableMeals and newPlan
      const availableMeals = [
        {
          id: 2,
          name: 'x',
          mealType: 'breakfast',
          effort: 1,
          hasRedMeat: false,
        },
      ];
      const newPlan = TestMockFactory.createMockMealPlan([
        TestMockFactory.createMockMealPlanItem({
          dayIndex: 6,
          mealType: MealSlot.BREAKFAST,
          mealSnapshot: TestMockFactory.createMockMeal({
            id: 2,
            name: 'x',
            effort: 1,
            hasRedMeat: false,
            mealType: 'breakfast',
          }),
        }),
      ]);
      workflow.client = {
        callTool: jest.fn().mockResolvedValue({
          content: [{ text: JSON.stringify(availableMeals) }],
        }),
      } as any;
      workflow.llm = {
        invoke: jest.fn().mockResolvedValue(JSON.stringify(newPlan)),
      } as any;
      workflow.extractJsonFromResponse = jest.fn((s: any) =>
        typeof s === 'string' ? s : JSON.stringify(s),
      );
    });
    it('applies feedback and returns new plan', async () => {
      // Setup: plan has Sunday breakfast with id 1, availableMeals has id 2
      const plan = TestMockFactory.createMockMealPlan([
        TestMockFactory.createMockMealPlanItem({
          dayIndex: 6,
          mealType: MealSlot.BREAKFAST,
          mealSnapshot: TestMockFactory.createMockMeal({
            id: 1,
            name: 'old',
            effort: 1,
            hasRedMeat: false,
            mealType: 'breakfast',
          }),
        }),
      ]);
      const availableMeals = [
        {
          id: 2,
          name: 'x',
          mealType: 'breakfast',
          effort: 1,
          hasRedMeat: false,
        },
      ];
      workflow.client.callTool.mockResolvedValue({
        content: [{ text: JSON.stringify(availableMeals) }],
      });
      workflow.llm.invoke.mockResolvedValue({
        content: JSON.stringify({
          replacements: [
            {
              day: 'Sunday',
              mealType: 'breakfast',
              oldMealId: 1,
              newMealId: 2,
              reason: 'Test replacement',
            },
          ],
          userMessage: 'done',
        }),
      });
      // Mock extractJsonFromResponse as identity
      workflow.extractJsonFromResponse = jest.fn((s: any) =>
        typeof s === 'string' ? s : JSON.stringify(s),
      );
      const res = await workflow.applyFeedbackWithLLM(plan, [
        'replace Sunday breakfast',
      ]);
      // Expect the plan to be updated with meal id 2
      expect(workflow.client.callTool).toHaveBeenCalledWith({
        name: 'getMeals',
        arguments: {},
      });
      expect(workflow.llm.invoke).toHaveBeenCalled();
      expect(res.userMessage).toBe('done');
      expect(res.mealPlan.items[0].mealSnapshot?.id).toBe(2);
      expect(res.mealPlan.items[0].mealSnapshot?.name).toBe('x');
    });
  });
  describe('optimizePlanNode', () => {
    it('throws when no meal_plan', async () => {
      await expect(
        workflow.optimizePlanNode({ iterationCount: 0, mealPlan: undefined }),
      ).rejects.toThrow('No meal plan to optimize');
    });
    it('calls optimizePlanWithLLM when issues exist', async () => {
      // Use enough consecutive high-effort meals to trigger validation
      const plan = TestMockFactory.createMockMealPlan([
        TestMockFactory.createMockMealPlanItem({
          dayIndex: 0,
          mealType: MealSlot.LUNCH,
          mealSnapshot: TestMockFactory.createMockMeal({
            id: 1,
            name: 'a',
            effort: 4,
            hasRedMeat: false,
            mealType: 'lunch',
          }),
        }),
        TestMockFactory.createMockMealPlanItem({
          dayIndex: 1,
          mealType: MealSlot.LUNCH,
          mealSnapshot: TestMockFactory.createMockMeal({
            id: 2,
            name: 'b',
            effort: 4,
            hasRedMeat: false,
            mealType: 'lunch',
          }),
        }),
        TestMockFactory.createMockMealPlanItem({
          dayIndex: 2,
          mealType: MealSlot.LUNCH,
          mealSnapshot: TestMockFactory.createMockMeal({
            id: 3,
            name: 'c',
            effort: 4,
            hasRedMeat: false,
            mealType: 'lunch',
          }),
        }),
      ]);
      workflow.optimizePlanWithLLM = jest.fn().mockResolvedValue(plan);
      const state = { mealPlan: plan, iterationCount: 0 } as any;
      const res: any = await workflow.optimizePlanNode(state);
      expect(workflow.optimizePlanWithLLM).toHaveBeenCalledWith(
        plan,
        expect.arrayContaining([
          expect.stringMatching(/Too many consecutive high-effort meals/),
        ]),
      );
      expect(res.currentStep).toBe(MealPlanningStep.PRESENT_PLAN);
      expect(res.mealPlan).toEqual(plan);
      expect(res.iterationCount).toBe(1);
    });
  });
});
