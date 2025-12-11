import React from 'react';
import { render, screen, act } from '@testing-library/react';
import MealPlanDisplay, { getEffortIcon } from './MealPlanDisplay';
import {
  MealPlan,
  MealPlanItem,
  Meal,
  MealSlot,
} from '@mealplanner/generated';

function makePlan(
  entries: Array<{ dayIndex: number; mealType: MealSlot; mealId?: number }>,
): MealPlan {
  const items = entries.map((entry) =>
    new MealPlanItem({
      dayIndex: entry.dayIndex,
      mealType: entry.mealType,
      mealId: entry.mealId,
      mealSnapshot: entry.mealId
        ? new Meal({
            id: entry.mealId,
            name: `Meal ${entry.mealId}`,
            effort: 1,
          })
        : undefined,
    }),
  );
  return new MealPlan({ items });
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
      { dayIndex: 0, mealType: MealSlot.BREAKFAST, mealId: 1 },
      { dayIndex: 0, mealType: MealSlot.DINNER, mealId: 2 },
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

describe('getEffortIcon', () => {
  it('returns correct icon by effort thresholds', () => {
    expect(getEffortIcon(2)).toBe('🙂');
    expect(getEffortIcon(4)).toBe('😅');
    expect(getEffortIcon(6)).toBe('😫');
    expect(getEffortIcon(8)).toBe('🥵');
  });
});
