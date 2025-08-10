import React, { useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import { WeeklyMealPlan, MealPlanEntry, Meal } from '@mealplanner/generated';
import useMealPlanHighlights from './useMealPlanHighlights';
import MealPlanDisplay from '../pages/AgentPage/components/plan/MealPlanDisplay';

function makePlan(
  entries: Array<{ dayIndex: number; mealType: string; mealId?: number }>,
): WeeklyMealPlan {
  const days = entries.map(
    (e) =>
      new MealPlanEntry({
        dayIndex: e.dayIndex,
        mealType: e.mealType,
        meal: e.mealId
          ? new Meal({ id: e.mealId, name: `Meal ${e.mealId}`, effort: 1 })
          : undefined,
      }),
  );
  return new WeeklyMealPlan({ days });
}

function Harness() {
  const [plan, setPlan] = useState<WeeklyMealPlan | null>(
    makePlan([
      { dayIndex: 0, mealType: 'breakfast', mealId: 1 },
      { dayIndex: 0, mealType: 'dinner', mealId: 2 },
    ]),
  );

  const { highlights, applyHighlights } = useMealPlanHighlights(plan, (p) =>
    setPlan(p),
  );

  // Expose to tests

  (global as any).__apply = applyHighlights;

  return plan ? <MealPlanDisplay plan={plan} highlights={highlights} /> : null;
}

describe('useMealPlanHighlights integration with MealPlanDisplay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();

    delete (global as any).__apply;
  });

  it('highlights changed meal rows after applyHighlights', () => {
    render(<Harness />);

    const newPlan = makePlan([
      { dayIndex: 0, mealType: 'breakfast', mealId: 3 }, // changed
      { dayIndex: 0, mealType: 'dinner', mealId: 2 }, // unchanged
    ]);

    act(() => {
      (global as any).__apply(newPlan);
    });

    const el = screen.getByTestId('meal-name-0-breakfast');
    expect(el.getAttribute('data-highlighted')).toBe('true');
  });
});
