import React, { useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import { MealPlan, MealPlanItem, MealSlot, Meal } from '@mealplanner/generated';
import useMealPlanHighlights from './useMealPlanHighlights';
import MealPlanDisplay from '../pages/AgentPage/components/plan/MealPlanDisplay';

function makePlan(
  entries: Array<{ dayIndex: number; mealType: MealSlot; mealId?: number }>,
): MealPlan {
  const items = entries.map((entry) =>
    new MealPlanItem({
      dayIndex: entry.dayIndex,
      mealType: entry.mealType,
      mealId: entry.mealId,
      mealSnapshot: entry.mealId
        ? new Meal({ id: entry.mealId, name: `Meal ${entry.mealId}`, effort: 1 })
        : undefined,
    }),
  );
  return new MealPlan({ items });
}

function Harness() {
  const [plan, setPlan] = useState<MealPlan | null>(
    makePlan([
      { dayIndex: 0, mealType: MealSlot.BREAKFAST, mealId: 1 },
      { dayIndex: 0, mealType: MealSlot.DINNER, mealId: 2 },
    ]),
  );

  const { highlights, applyHighlights } = useMealPlanHighlights(plan, (p) =>
    setPlan(p),
  );

  // Expose to tests

  (globalThis as unknown as { __apply: (p: MealPlan) => void }).__apply =
    applyHighlights;

  return plan ? <MealPlanDisplay plan={plan} highlights={highlights} /> : null;
}

describe('useMealPlanHighlights integration with MealPlanDisplay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();

    delete (globalThis as unknown as { __apply?: unknown }).__apply;
  });

  it('highlights changed meal rows after applyHighlights', () => {
    render(<Harness />);

    const newPlan = makePlan([
      { dayIndex: 0, mealType: MealSlot.BREAKFAST, mealId: 3 }, // changed
      { dayIndex: 0, mealType: MealSlot.DINNER, mealId: 2 }, // unchanged
    ]);

    act(() => {
      (globalThis as unknown as { __apply: (p: MealPlan) => void }).__apply(
        newPlan,
      );
    });

    const el = screen.getByTestId('meal-name-0-breakfast');
    expect(el.getAttribute('data-highlighted')).toBe('true');
  });
});
