import { MealPlannerAgent, VALIDATION_CRITERIA } from '../agent.js';

const basePlan = {
  days: [
    { dayIndex: 0, meal: { id: 1, name: 'A', effort: 2, hasRedMeat: false } },
    { dayIndex: 1, meal: { id: 2, name: 'B', effort: 2, hasRedMeat: false } },
    { dayIndex: 2, meal: { id: 3, name: 'C', effort: 2, hasRedMeat: false } },
  ]
};

describe('MealPlannerAgent.validatePlan', () => {
  const agent = new MealPlannerAgent();

  it('detects consecutive high effort meals', () => {
    const plan = {
      days: [
        { dayIndex: 0, meal: { id: 1, name: 'A', effort: 4, hasRedMeat: false } },
        { dayIndex: 1, meal: { id: 2, name: 'B', effort: 4, hasRedMeat: false } },
        { dayIndex: 2, meal: { id: 3, name: 'C', effort: 4, hasRedMeat: false } },
      ]
    };
    const issues = agent.validatePlan(plan as any);
    expect(issues).toContain(
      `Too many consecutive high-effort meals (day 2)`
    );
  });

  it('detects too much red meat', () => {
    const plan = {
      days: [
        { dayIndex: 0, meal: { id: 1, name: 'A', effort: 2, hasRedMeat: true } },
        { dayIndex: 1, meal: { id: 2, name: 'B', effort: 2, hasRedMeat: true } },
        { dayIndex: 2, meal: { id: 3, name: 'C', effort: 2, hasRedMeat: true } },
        { dayIndex: 3, meal: { id: 4, name: 'D', effort: 2, hasRedMeat: true } },
      ]
    };
    const issues = agent.validatePlan(plan as any);
    expect(issues).toContain(
      `Too many red meat meals: 4 (max ${VALIDATION_CRITERIA.maxRedMeatPerWeek})`
    );
  });

  it('detects duplicate meals', () => {
    const plan = {
      days: [
        { dayIndex: 0, meal: { id: 1, name: 'A', effort: 2, hasRedMeat: false } },
        { dayIndex: 1, meal: { id: 1, name: 'A', effort: 2, hasRedMeat: false } },
      ]
    };
    const issues = agent.validatePlan(plan as any);
    expect(issues).toContain('Duplicate meals found: 1');
  });
});
