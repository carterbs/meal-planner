import React, { PropsWithChildren, useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import { WeeklyMealPlan, MealPlanEntry, Meal } from '@mealplanner/generated';
import useMealPlanHighlights from './useMealPlanHighlights';

function makePlan(
  entries: Array<{ dayIndex: number; mealType: string; mealId: number }>,
): WeeklyMealPlan {
  const days = entries.map(
    (e) =>
      new MealPlanEntry({
        dayIndex: e.dayIndex,
        mealType: e.mealType,
        meal: new Meal({ id: e.mealId, name: `Meal ${e.mealId}`, effort: 1 }),
      }),
  );
  return new WeeklyMealPlan({ days });
}

function HookHarness({
  initialPlan,
}: PropsWithChildren<{ initialPlan: WeeklyMealPlan | null }>) {
  const [plan, setPlan] = useState<WeeklyMealPlan | null>(initialPlan);
  const { highlights, applyHighlights, resetHighlights } =
    useMealPlanHighlights(plan, (p) => setPlan(p));

  // Expose controls for tests

  (globalThis as unknown as {
    __harness: {
      setPlan: (p: WeeklyMealPlan | null) => void;
      applyHighlights: (p: WeeklyMealPlan) => void;
      resetHighlights: () => void;
      getHighlights: () => Set<string>;
      getPlan: () => WeeklyMealPlan | null;
    };
  }).__harness = {
    setPlan,
    applyHighlights,
    resetHighlights,
    getHighlights: () => highlights,
    getPlan: () => plan,
  };

  return (
    <div>
      <div data-testid="highlight-count">{highlights.size}</div>
      <div data-testid="plan-size">{plan?.days.length ?? 0}</div>
    </div>
  );
}

describe('useMealPlanHighlights', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();

    delete (globalThis as unknown as { __harness?: unknown }).__harness;
  });

  it('detects changed dayIndex-mealType pairs and sets the plan', () => {
    const base = makePlan([
      { dayIndex: 0, mealType: 'breakfast', mealId: 1 },
      { dayIndex: 0, mealType: 'dinner', mealId: 2 },
    ]);

    render(<HookHarness initialPlan={base} />);

    const newPlan = makePlan([
      { dayIndex: 0, mealType: 'breakfast', mealId: 3 }, // changed
      { dayIndex: 0, mealType: 'dinner', mealId: 2 }, // unchanged
    ]);

    act(() => {
      (globalThis as unknown as { __harness: { applyHighlights: (p: WeeklyMealPlan) => void } }).__harness.applyHighlights(newPlan);
    });

    const count = screen.getByTestId('highlight-count');
    expect(count.textContent).toBe('1');

    const highlights: Set<string> = (globalThis as unknown as { __harness: { getHighlights: () => Set<string> } }).__harness.getHighlights();
    expect(highlights.has('0-breakfast')).toBe(true);

    // plan should be updated
    const planSize = screen.getByTestId('plan-size');
    expect(planSize.textContent).toBe('2');
  });

  it('auto clears changed highlights after 5s', () => {
    const base = makePlan([{ dayIndex: 1, mealType: 'dinner', mealId: 2 }]);

    render(<HookHarness initialPlan={base} />);

    const newPlan = makePlan([
      { dayIndex: 1, mealType: 'dinner', mealId: 5 }, // changed
    ]);

    act(() => {
      (globalThis as unknown as { __harness: { applyHighlights: (p: WeeklyMealPlan) => void } }).__harness.applyHighlights(newPlan);
    });

    expect(screen.getByTestId('highlight-count').textContent).toBe('1');

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId('highlight-count').textContent).toBe('0');
  });

  it('resetHighlights clears all current highlights', () => {
    const base = makePlan([{ dayIndex: 2, mealType: 'lunch', mealId: 9 }]);

    render(<HookHarness initialPlan={base} />);

    const newPlan = makePlan([{ dayIndex: 2, mealType: 'lunch', mealId: 10 }]);

    act(() => {
      (globalThis as unknown as { __harness: { applyHighlights: (p: WeeklyMealPlan) => void } }).__harness.applyHighlights(newPlan);
    });

    expect(screen.getByTestId('highlight-count').textContent).toBe('1');

    act(() => {
      (globalThis as unknown as { __harness: { resetHighlights: () => void } }).__harness.resetHighlights();
    });

    expect(screen.getByTestId('highlight-count').textContent).toBe('0');
  });

  it('does nothing when plan is unchanged (no highlights scheduled)', () => {
    const base = makePlan([{ dayIndex: 0, mealType: 'breakfast', mealId: 1 }]);
    render(<HookHarness initialPlan={base} />);

    act(() => {
      (globalThis as unknown as { __harness: { applyHighlights: (p: WeeklyMealPlan) => void } }).__harness.applyHighlights(base);
    });

    expect(screen.getByTestId('highlight-count').textContent).toBe('0');
    act(() => {
      jest.advanceTimersByTime(6000);
    });
    expect(screen.getByTestId('highlight-count').textContent).toBe('0');
  });

  it('cleans up pending timeout on unmount', () => {
    const base = makePlan([{ dayIndex: 0, mealType: 'dinner', mealId: 1 }]);
    const { unmount } = render(<HookHarness initialPlan={base} />);
    const spy = jest.spyOn(window, 'clearTimeout');

    const newPlan = makePlan([{ dayIndex: 0, mealType: 'dinner', mealId: 2 }]);
    act(() => {
      (globalThis as unknown as { __harness: { applyHighlights: (p: WeeklyMealPlan) => void } }).__harness.applyHighlights(newPlan);
    });
    expect(screen.getByTestId('highlight-count').textContent).toBe('1');

    unmount();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
