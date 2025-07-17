import { MealPlanningWorkflow } from '../workflows/meal-planning';
import { VALIDATION_CRITERIA } from '../shared/types';
import { HttpCheckpointSaver } from '../shared/httpCheckpointer';
import { TestMockFactory, setupConsoleMocks, restoreConsoleMocks } from './test-utils';

// Mock external dependencies
jest.mock('../utils/getBackendClient');
jest.mock('../logging');
jest.mock('../cli');

describe('MealPlanningWorkflow Validation Edge Cases', () => {
  let workflow: any;
  let mockCheckpointer: jest.Mocked<HttpCheckpointSaver>;

  beforeEach(() => {
    setupConsoleMocks();
    
    mockCheckpointer = TestMockFactory.createMockCheckpointer() as any;
    workflow = new MealPlanningWorkflow(mockCheckpointer) as any;
  });

  afterEach(() => {
    restoreConsoleMocks();
    jest.clearAllMocks();
  });

  describe('validatePlan edge cases', () => {
    it('validates plan with missing meals', () => {
      const planWithMissingMeals = TestMockFactory.createMockWeeklyMealPlan([
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: 0,
          mealType: 'breakfast',
          meal: TestMockFactory.createMockMeal({ id: 1, name: 'Breakfast' }),
        }),
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: 0,
          mealType: 'lunch',
          meal: undefined, // Missing meal
        }),
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: 0,
          mealType: 'dinner',
          meal: TestMockFactory.createMockMeal({ id: 2, name: 'Dinner' }),
        }),
      ]);

      const issues = workflow.validatePlan(planWithMissingMeals);

      // Should not generate validation issues for missing meals
      expect(issues).toEqual([]);
    });

    it('handles validation with null meal entries', () => {
      const planWithNullMeals = TestMockFactory.createMockWeeklyMealPlan([
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: 0,
          mealType: 'breakfast',
          meal: TestMockFactory.createMockMeal({ id: 1, name: 'Breakfast' }),
        }),
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: 0,
          mealType: 'lunch',
          meal: null as any, // Null meal
        }),
      ]);

      const issues = workflow.validatePlan(planWithNullMeals);

      // Should not crash and should not generate issues for null meals
      expect(issues).toEqual([]);
    });

    it('calculates consecutive high-effort meals across meal types', () => {
      // const { maxConsecutiveHighEffort } = VALIDATION_CRITERIA;
      
      // Create meals that span different meal types but are consecutive in days
      const consecutiveHighEffortMeals = [
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: 0,
          mealType: 'dinner',
          meal: TestMockFactory.createMockMeal({ id: 1, effort: 4 }),
        }),
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: 1,
          mealType: 'breakfast',
          meal: TestMockFactory.createMockMeal({ id: 2, effort: 4 }),
        }),
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: 1,
          mealType: 'lunch',
          meal: TestMockFactory.createMockMeal({ id: 3, effort: 4 }),
        }),
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: 1,
          mealType: 'dinner',
          meal: TestMockFactory.createMockMeal({ id: 4, effort: 4 }),
        }),
      ];

      const plan = TestMockFactory.createMockWeeklyMealPlan(consecutiveHighEffortMeals);
      const issues = workflow.validatePlan(plan);

      // Should detect consecutive high-effort meals
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some((issue: any) => issue.includes('consecutive high-effort meals'))).toBe(true);
    });

    it('validates red meat count with mixed meal types', () => {
      const { maxRedMeatPerWeek } = VALIDATION_CRITERIA;
      
      // Create exactly maxRedMeatPerWeek + 1 red meat meals across different meal types
      const redMeatMeals = Array.from({ length: maxRedMeatPerWeek + 1 }, (_, i) => 
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: Math.floor(i / 3), // Spread across days
          mealType: ['breakfast', 'lunch', 'dinner'][i % 3],
          meal: TestMockFactory.createMockMeal({
            id: i + 1,
            name: `Red Meat Meal ${i + 1}`,
            hasRedMeat: true,
          }),
        })
      );

      const plan = TestMockFactory.createMockWeeklyMealPlan(redMeatMeals);
      const issues = workflow.validatePlan(plan);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some((issue: any) => issue.includes('Too many red meat meals'))).toBe(true);
    });

    it('handles empty meal plan gracefully', () => {
      const emptyPlan = TestMockFactory.createMockWeeklyMealPlan([]);
      const issues = workflow.validatePlan(emptyPlan);

      expect(issues).toEqual([]);
    });

    it('validates plan with only red meat meals at limit', () => {
      const { maxRedMeatPerWeek } = VALIDATION_CRITERIA;
      
      // Create exactly maxRedMeatPerWeek red meat meals
      const redMeatMeals = Array.from({ length: maxRedMeatPerWeek }, (_, i) => 
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: i,
          mealType: 'dinner',
          meal: TestMockFactory.createMockMeal({
            id: i + 1,
            hasRedMeat: true,
          }),
        })
      );

      const plan = TestMockFactory.createMockWeeklyMealPlan(redMeatMeals);
      const issues = workflow.validatePlan(plan);

      // Should not flag as over limit
      expect(issues.some((issue: any) => issue.includes('Too many red meat meals'))).toBe(false);
    });

    it('validates plan with high-effort meals at limit', () => {
      const { maxConsecutiveHighEffort } = VALIDATION_CRITERIA;
      
      // Create exactly maxConsecutiveHighEffort high-effort meals
      const highEffortMeals = Array.from({ length: maxConsecutiveHighEffort }, (_, i) => 
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: i,
          mealType: 'dinner',
          meal: TestMockFactory.createMockMeal({
            id: i + 1,
            effort: 4,
          }),
        })
      );

      const plan = TestMockFactory.createMockWeeklyMealPlan(highEffortMeals);
      const issues = workflow.validatePlan(plan);

      // Should not flag as over limit
      expect(issues.some((issue: any) => issue.includes('consecutive high-effort meals'))).toBe(false);
    });

    it('handles duplicate meals with different meal types', () => {
      const duplicateMeal = TestMockFactory.createMockMeal({ id: 1, name: 'Versatile Meal' });
      
      const planWithDuplicates = TestMockFactory.createMockWeeklyMealPlan([
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: 0,
          mealType: 'breakfast',
          meal: duplicateMeal,
        }),
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: 1,
          mealType: 'lunch',
          meal: duplicateMeal,
        }),
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: 2,
          mealType: 'dinner',
          meal: duplicateMeal,
        }),
      ]);

      const issues = workflow.validatePlan(planWithDuplicates);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some((issue: any) => issue.includes('Duplicate meals found: 1'))).toBe(true);
    });

    it('handles meals with zero effort', () => {
      const zeroEffortMeals = [
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: 0,
          mealType: 'breakfast',
          meal: TestMockFactory.createMockMeal({ id: 1, effort: 0 }),
        }),
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: 1,
          mealType: 'lunch',
          meal: TestMockFactory.createMockMeal({ id: 2, effort: 0 }),
        }),
      ];

      const plan = TestMockFactory.createMockWeeklyMealPlan(zeroEffortMeals);
      const issues = workflow.validatePlan(plan);

      // Zero effort meals should not be considered high-effort
      expect(issues.some((issue: any) => issue.includes('consecutive high-effort meals'))).toBe(false);
    });

    it('handles meals with negative effort', () => {
      const negativeEffortMeals = [
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: 0,
          mealType: 'dinner',
          meal: TestMockFactory.createMockMeal({ id: 1, effort: -1 }),
        }),
      ];

      const plan = TestMockFactory.createMockWeeklyMealPlan(negativeEffortMeals);
      const issues = workflow.validatePlan(plan);

      // Should not crash and should not be considered high-effort
      expect(issues.some((issue: any) => issue.includes('consecutive high-effort meals'))).toBe(false);
    });

    it('handles meals with boundary effort values', () => {
      const boundaryEffortMeals = [
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: 0,
          mealType: 'breakfast',
          meal: TestMockFactory.createMockMeal({ id: 1, effort: 3 }), // Just below high-effort threshold
        }),
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: 1,
          mealType: 'lunch',
          meal: TestMockFactory.createMockMeal({ id: 2, effort: 4 }), // At high-effort threshold
        }),
      ];

      const plan = TestMockFactory.createMockWeeklyMealPlan(boundaryEffortMeals);
      const issues = workflow.validatePlan(plan);

      // Only effort > 3 should be considered high-effort
      expect(issues.some((issue: any) => issue.includes('consecutive high-effort meals'))).toBe(false);
    });

    it('handles plan with meals spanning all days of week', () => {
      const fullWeekMeals = Array.from({ length: 21 }, (_, i) => // 7 days × 3 meals
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: Math.floor(i / 3),
          mealType: ['breakfast', 'lunch', 'dinner'][i % 3],
          meal: TestMockFactory.createMockMeal({
            id: i + 1,
            name: `Meal ${i + 1}`,
            effort: 2,
            hasRedMeat: false,
          }),
        })
      );

      const plan = TestMockFactory.createMockWeeklyMealPlan(fullWeekMeals);
      const issues = workflow.validatePlan(plan);

      // Should not have any validation issues
      expect(issues).toEqual([]);
    });

    it('handles meals with missing or undefined properties', () => {
      const mealsWithMissingProperties = [
        TestMockFactory.createMockMealPlanEntry({
          dayIndex: 0,
          mealType: 'breakfast',
          meal: TestMockFactory.createMockMeal({
            id: 1,
            effort: undefined as any, // Missing effort
            hasRedMeat: undefined as any, // Missing hasRedMeat
          }),
        }),
      ];

      const plan = TestMockFactory.createMockWeeklyMealPlan(mealsWithMissingProperties);
      
      // Should not crash during validation
      expect(() => workflow.validatePlan(plan)).not.toThrow();
    });
  });
});