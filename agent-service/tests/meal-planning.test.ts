import { MealPlanningWorkflow } from '../workflows/meal-planning';
import { VALIDATION_CRITERIA } from '../shared/types';
import { WeeklyMealPlan, MealPlanEntry, Meal } from '@mealplanner/generated';
import { HttpCheckpointSaver } from '../shared/httpCheckpointer';

describe('MealPlanningWorkflow logic', () => {
  let workflow: any;
  const mockCheckpointer = {} as HttpCheckpointSaver;

  beforeAll(() => {
    workflow = new MealPlanningWorkflow(mockCheckpointer) as any;
  });

  describe('extractJsonFromResponse', () => {
    it('removes markdown fences and trims whitespace', () => {
      const input = '```json\n  { \"foo\": \"bar\" }  \n```';
      const out = workflow.extractJsonFromResponse(input);
      expect(out).toBe('{ \"foo\": \"bar\" }');
    });
    it('handles strings without fences untouched', () => {
      const input = '{\"a\":1}';
      expect(workflow.extractJsonFromResponse(input)).toBe('{\"a\":1}');
    });
  });

  describe('validatePlan', () => {
    function makePlan(days: MealPlanEntry[]): WeeklyMealPlan {
      return new WeeklyMealPlan({ days, shoppingList: [] });
    }

    it('returns no issues for empty plan', () => {
      expect(workflow.validatePlan(makePlan([]))).toEqual([]);
    });

    it('flags too many consecutive high-effort meals', () => {
      const { maxConsecutiveHighEffort } = VALIDATION_CRITERIA;
      const days = Array(maxConsecutiveHighEffort + 2)
        .fill(null)
        .map(
          (_, i) =>
            new MealPlanEntry({
              dayIndex: i,
              mealType: 'dinner',
              meal: new Meal({
                id: i,
                name: 'm',
                effort: 4,
                hasRedMeat: false,
                lastPlanned: undefined,
                url: '',
                mealType: '',
                ingredients: [],
                steps: [],
              }),
            }),
        );
      const issues = workflow.validatePlan(makePlan(days));
      expect(issues).toContain(
        `Too many consecutive high-effort meals (day ${maxConsecutiveHighEffort + 1})`,
      );
    });

    it('flags too many red meat meals', () => {
      const { maxRedMeatPerWeek } = VALIDATION_CRITERIA;
      const days = Array(maxRedMeatPerWeek + 1)
        .fill(null)
        .map(
          (_, i) =>
            new MealPlanEntry({
              dayIndex: i,
              mealType: 'lunch',
              meal: new Meal({
                id: i,
                name: 'm',
                effort: 1,
                hasRedMeat: true,
                lastPlanned: undefined,
                url: '',
                mealType: '',
                ingredients: [],
                steps: [],
              }),
            }),
        );
      const issues = workflow.validatePlan(makePlan(days));
      expect(issues).toContain(
        `Too many red meat meals: ${maxRedMeatPerWeek + 1} (max ${maxRedMeatPerWeek})`,
      );
    });

    it('flags duplicate meals', () => {
      const days = [
        new MealPlanEntry({
          dayIndex: 0,
          mealType: 'breakfast',
          meal: new Meal({
            id: 1,
            name: 'a',
            effort: 1,
            hasRedMeat: false,
            lastPlanned: undefined,
            url: '',
            mealType: '',
            ingredients: [],
            steps: [],
          }),
        }),
        new MealPlanEntry({
          dayIndex: 1,
          mealType: 'lunch',
          meal: new Meal({
            id: 2,
            name: 'b',
            effort: 1,
            hasRedMeat: false,
            lastPlanned: undefined,
            url: '',
            mealType: '',
            ingredients: [],
            steps: [],
          }),
        }),
        new MealPlanEntry({
          dayIndex: 2,
          mealType: 'dinner',
          meal: new Meal({
            id: 1,
            name: 'a',
            effort: 1,
            hasRedMeat: false,
            lastPlanned: undefined,
            url: '',
            mealType: '',
            ingredients: [],
            steps: [],
          }),
        }),
      ];
      const issues = workflow.validatePlan(makePlan(days));
      expect(issues).toContain('Duplicate meals found: 1');
    });

    it('returns no issues for valid plan', () => {
      const days = [
        new MealPlanEntry({
          dayIndex: 0,
          mealType: 'breakfast',
          meal: new Meal({
            id: 1,
            name: 'a',
            effort: 1,
            hasRedMeat: false,
            lastPlanned: undefined,
            url: '',
            mealType: '',
            ingredients: [],
            steps: [],
          }),
        }),
        new MealPlanEntry({
          dayIndex: 1,
          mealType: 'lunch',
          meal: new Meal({
            id: 2,
            name: 'b',
            effort: 2,
            hasRedMeat: false,
            lastPlanned: undefined,
            url: '',
            mealType: '',
            ingredients: [],
            steps: [],
          }),
        }),
        new MealPlanEntry({
          dayIndex: 2,
          mealType: 'dinner',
          meal: new Meal({
            id: 3,
            name: 'c',
            effort: 1,
            hasRedMeat: false,
            lastPlanned: undefined,
            url: '',
            mealType: '',
            ingredients: [],
            steps: [],
          }),
        }),
      ];
      expect(workflow.validatePlan(makePlan(days))).toEqual([]);
    });
  });
});
