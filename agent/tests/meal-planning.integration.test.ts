import { MealPlanningWorkflow } from '../workflows/meal-planning';
import { WeeklyMealPlan, MealPlanningStep } from '../shared/types';
import { PostgresCheckpointSaver } from '../shared/checkpointer';

describe('MealPlanningWorkflow LLM integration and edge cases', () => {
  let workflow: any;
  const mockCheckpointer = {} as PostgresCheckpointSaver;

  beforeAll(() => {
    workflow = new MealPlanningWorkflow(mockCheckpointer) as any;
  });

  describe('analyzeFeedbackNode', () => {
    it('parses satisfied JSON response', async () => {
      workflow.nanoLlm = { invoke: jest.fn().mockResolvedValue({ content: '```json\n{"satisfied":true,"reasoning":"Great"}\n```' }) };
      const feedback = [{ message: 'looks good', timestamp: new Date().toISOString() }];
      const res = await workflow.analyzeFeedbackNode(feedback);
      expect(res).toEqual({ satisfied: true, reasoning: 'Great' });
    });

    it('handles unparsable JSON gracefully', async () => {
      workflow.nanoLlm = { invoke: jest.fn().mockResolvedValue({ content: 'not json' }) };
      const feedback = [{ message: 'meh', timestamp: new Date().toISOString() }];
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await workflow.analyzeFeedbackNode(feedback);
      expect(res).toHaveProperty('satisfied', false);
      spy.mockRestore();
    });
  });

  describe('applyFeedbackWithLLM', () => {
    beforeEach(() => {
      // Mocks for availableMeals and newPlan
      const availableMeals = [{ id: 2, mealName: 'x', mealType: 'breakfast', relativeEffort: 1, redMeat: false }];
      const newPlan = { days: [ { dayIndex: 0, mealType: 'breakfast', meal: { id: 2, name: 'x', effort: 1, hasRedMeat: false } } ] };
      workflow.client = { callTool: jest.fn().mockResolvedValue({ content: [{ text: JSON.stringify(availableMeals) }] }) } as any;
      workflow.llm = { invoke: jest.fn().mockResolvedValue(JSON.stringify(newPlan)) } as any;
      workflow.extractJsonFromResponse = jest.fn((s: any) => (typeof s === 'string' ? s : JSON.stringify(s)) );
    });

    it('applies feedback and returns new plan', async () => {
      // Setup: plan has Sunday breakfast with id 1, availableMeals has id 2
      const plan = { days: [ { dayIndex: 0, mealType: 'breakfast', meal: { id: 1, name: 'old', effort: 1, hasRedMeat: false } } ] };
      const availableMeals = [{ id: 2, mealName: 'x', mealType: 'breakfast', relativeEffort: 1, redMeat: false }];
      workflow.client.callTool.mockResolvedValue({ content: [{ text: JSON.stringify(availableMeals) }] });
      workflow.llm.invoke.mockResolvedValue({ content: JSON.stringify({
        replacements: [
          { day: 'Sunday', mealType: 'breakfast', oldMealId: 1, newMealId: 2, reason: 'Test replacement' }
        ],
        userMessage: 'done'
      }) });
      // Mock extractJsonFromResponse as identity
      workflow.extractJsonFromResponse = jest.fn((s: any) => (typeof s === 'string' ? s : JSON.stringify(s)) );
      const res = await workflow.applyFeedbackWithLLM(plan, ['replace Sunday breakfast']);
      // Expect the plan to be updated with meal id 2
      const expectedPlan = { days: [ { dayIndex: 0, mealType: 'breakfast', meal: { id: 2, name: 'x', effort: 1, hasRedMeat: false } } ] };
      expect(workflow.client.callTool).toHaveBeenCalledWith({ name: 'getMeals', arguments: {} });
      expect(workflow.llm.invoke).toHaveBeenCalled();
      expect(res).toEqual({ mealPlan: expectedPlan, userMessage: 'done' });
    });
  });

  describe('optimizePlanNode', () => {
    it('throws when no meal_plan', async () => {
      await expect(workflow.optimizePlanNode({ iteration_count: 0 })).rejects.toThrow('No meal plan to optimize');
    });

    it('calls optimizePlanWithLLM when issues exist', async () => {
      // Use enough consecutive high-effort meals to trigger validation
      const plan = {
        days: [
          { dayIndex: 0, mealType: 'lunch', meal: { id: 1, name: 'a', effort: 4, hasRedMeat: false } },
          { dayIndex: 1, mealType: 'lunch', meal: { id: 2, name: 'b', effort: 4, hasRedMeat: false } },
          { dayIndex: 2, mealType: 'lunch', meal: { id: 3, name: 'c', effort: 4, hasRedMeat: false } },
        ]
      } as WeeklyMealPlan;
      workflow.optimizePlanWithLLM = jest.fn().mockResolvedValue(plan);

      const state = { meal_plan: plan, iteration_count: 0 } as any;
      const res: any = await workflow.optimizePlanNode(state);

      expect(workflow.optimizePlanWithLLM).toHaveBeenCalledWith(
        plan,
        expect.arrayContaining([expect.stringMatching(/Too many consecutive high-effort meals/)]),
      );
      expect(res.current_step).toBe(MealPlanningStep.PRESENT_PLAN);
      expect(res.meal_plan).toEqual(plan);
      expect(res.iteration_count).toBe(1);
      expect(res).toHaveProperty('updated_at');
    });
  });
});
