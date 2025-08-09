import React from 'react';
import { render, screen, act } from '@testing-library/react';
import MealPlanDisplay from './MealPlanDisplay';
import { WeeklyMealPlan, MealPlanEntry, Meal } from '@mealplanner/generated';

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

describe('MealPlanDisplay highlights', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders highlight state when provided and visually fades (non-visual assert via data attribute)', () => {
    const plan = makePlan([
      { dayIndex: 0, mealType: 'breakfast', mealId: 1 },
      { dayIndex: 0, mealType: 'dinner', mealId: 2 },
    ]);

    const highlights = new Set<string>(['0-breakfast']);

    const { rerender } = render(
      <MealPlanDisplay plan={plan} highlights={highlights} />,
    );

    const highlighted = screen.getByTestId('meal-name-0-breakfast');
    expect(highlighted.getAttribute('data-highlighted')).toBe('true');

    // Simulate clearing highlight externally after timeout
    act(() => {
      highlights.delete('0-breakfast');
    });

    rerender(<MealPlanDisplay plan={plan} highlights={highlights} />);

    const allEls = screen.getAllByTestId('meal-name-0-breakfast');
    const last = allEls[allEls.length - 1];
    expect(last.getAttribute('data-highlighted')).toBe(null);
  });
});
