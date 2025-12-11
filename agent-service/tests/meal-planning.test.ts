import { MealPlanningWorkflow } from '../workflows/meal-planning';
import { VALIDATION_CRITERIA } from '../shared/types';
import { MealPlan, MealPlanItem, MealSlot, Meal } from '@mealplanner/generated';
import { DbCheckpointSaver } from '../shared/dbCheckpointer';
describe('MealPlanningWorkflow logic', () => {
  let workflow: any;
  const mockCheckpointer = {} as DbCheckpointSaver;
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
    function makePlan(items: MealPlanItem[]): MealPlan {
      return new MealPlan({ items });
    }

    function createItem(
      dayIndex: number,
      mealSlot: MealSlot,
      meal: Meal,
    ): MealPlanItem {
      return new MealPlanItem({
        dayIndex,
        mealType: mealSlot,
        mealSnapshot: meal,
        mealId: meal.id,
      });
    }

    it('returns no issues for empty plan', () => {
      expect(workflow.validatePlan(makePlan([]))).toEqual([]);
    });

    it('flags too many consecutive high-effort meals', () => {
      const { maxConsecutiveHighEffort } = VALIDATION_CRITERIA;
      const items = Array(maxConsecutiveHighEffort + 2)
        .fill(null)
        .map((_, i) =>
          createItem(
            i,
            MealSlot.DINNER,
            new Meal({
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
          ),
        );
      const issues = workflow.validatePlan(makePlan(items));
      expect(issues).toContain(
        `Too many consecutive high-effort meals (day ${maxConsecutiveHighEffort + 1})`,
      );
    });

    it('flags too many red meat meals', () => {
      const { maxRedMeatPerWeek } = VALIDATION_CRITERIA;
      const items = Array(maxRedMeatPerWeek + 1)
        .fill(null)
        .map((_, i) =>
          createItem(
            i,
            MealSlot.LUNCH,
            new Meal({
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
          ),
        );
      const issues = workflow.validatePlan(makePlan(items));
      expect(issues).toContain(
        `Too many red meat meals: ${maxRedMeatPerWeek + 1} (max ${maxRedMeatPerWeek})`,
      );
    });

    it('flags duplicate meals', () => {
      const items = [
        createItem(
          0,
          MealSlot.BREAKFAST,
          new Meal({
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
        ),
        createItem(
          1,
          MealSlot.LUNCH,
          new Meal({
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
        ),
        createItem(
          2,
          MealSlot.DINNER,
          new Meal({
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
        ),
      ];
      const issues = workflow.validatePlan(makePlan(items));
      expect(issues).toContain('Duplicate meals found: 1');
    });

    it('returns no issues for valid plan', () => {
      const items = [
        createItem(
          0,
          MealSlot.BREAKFAST,
          new Meal({
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
        ),
        createItem(
          1,
          MealSlot.LUNCH,
          new Meal({
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
        ),
        createItem(
          2,
          MealSlot.DINNER,
          new Meal({
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
        ),
      ];
      expect(workflow.validatePlan(makePlan(items))).toEqual([]);
    });
  });
});
