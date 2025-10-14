import React, { PropsWithChildren, useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import {
  MealPlan,
  MealPlanItem,
  MealSlot,
  Meal,
} from '@mealplanner/generated';
import useMealPlanHighlights from './useMealPlanHighlights';

function makePlan(
  entries: Array<{ dayIndex: number; mealType: MealSlot; mealId: number }>,
): MealPlan {
  const items = entries.map(
    (entry) =>
      new MealPlanItem({
        dayIndex: entry.dayIndex,
        mealType: entry.mealType,
        mealSnapshot: new Meal({
          id: entry.mealId,
          name: `Meal ${entry.mealId}`,
          effort: 1,
        }),
      }),
  );
  return new MealPlan({ items });
}

function HookHarness({
  initialPlan,
}: PropsWithChildren<{ initialPlan: MealPlan | null }>) {
  const [plan, setPlan] = useState<MealPlan | null>(initialPlan);
  const { highlights, applyHighlights, resetHighlights } =
    useMealPlanHighlights(plan, (p) => setPlan(p));

  // Expose controls for tests

  (globalThis as unknown as {
    __harness: {
      setPlan: (p: MealPlan | null) => void;
      applyHighlights: (p: MealPlan) => void;
      resetHighlights: () => void;
      getHighlights: () => Set<string>;
      getPlan: () => MealPlan | null;
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
      <div data-testid="plan-size">{plan?.items.length ?? 0}</div>
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
      { dayIndex: 0, mealType: MealSlot.BREAKFAST, mealId: 1 },
      { dayIndex: 0, mealType: MealSlot.DINNER, mealId: 2 },
    ]);

    render(<HookHarness initialPlan={base} />);

    const newPlan = makePlan([
      { dayIndex: 0, mealType: MealSlot.BREAKFAST, mealId: 3 }, // changed
      { dayIndex: 0, mealType: MealSlot.DINNER, mealId: 2 }, // unchanged
    ]);

    act(() => {
      (globalThis as unknown as { __harness: { applyHighlights: (p: MealPlan) => void } }).__harness.applyHighlights(newPlan);
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
    const base = makePlan([
      { dayIndex: 1, mealType: MealSlot.DINNER, mealId: 2 },
    ]);

    render(<HookHarness initialPlan={base} />);

    const newPlan = makePlan([
      { dayIndex: 1, mealType: MealSlot.DINNER, mealId: 5 }, // changed
    ]);

    act(() => {
      (globalThis as unknown as { __harness: { applyHighlights: (p: MealPlan) => void } }).__harness.applyHighlights(newPlan);
    });

    expect(screen.getByTestId('highlight-count').textContent).toBe('1');

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId('highlight-count').textContent).toBe('0');
  });

  it('resetHighlights clears all current highlights', () => {
    const base = makePlan([
      { dayIndex: 2, mealType: MealSlot.LUNCH, mealId: 9 },
    ]);

    render(<HookHarness initialPlan={base} />);

    const newPlan = makePlan([
      { dayIndex: 2, mealType: MealSlot.LUNCH, mealId: 10 },
    ]);

    act(() => {
      (globalThis as unknown as { __harness: { applyHighlights: (p: MealPlan) => void } }).__harness.applyHighlights(newPlan);
    });

    expect(screen.getByTestId('highlight-count').textContent).toBe('1');

    act(() => {
      (globalThis as unknown as { __harness: { resetHighlights: () => void } }).__harness.resetHighlights();
    });

    expect(screen.getByTestId('highlight-count').textContent).toBe('0');
  });

  it('does nothing when plan is unchanged (no highlights scheduled)', () => {
    const base = makePlan([
      { dayIndex: 0, mealType: MealSlot.BREAKFAST, mealId: 1 },
    ]);
    render(<HookHarness initialPlan={base} />);

    act(() => {
      (globalThis as unknown as { __harness: { applyHighlights: (p: MealPlan) => void } }).__harness.applyHighlights(base);
    });

    expect(screen.getByTestId('highlight-count').textContent).toBe('0');
    act(() => {
      jest.advanceTimersByTime(6000);
    });
    expect(screen.getByTestId('highlight-count').textContent).toBe('0');
  });

  it('replaces highlights when multiple changes occur - only shows most recent changes', () => {
    const base = makePlan([
      { dayIndex: 2, mealType: MealSlot.LUNCH, mealId: 1 },
      { dayIndex: 1, mealType: MealSlot.DINNER, mealId: 2 },
    ]);
    
    render(<HookHarness initialPlan={base} />);

    // First change: Remove wednesday lunch (change meal ID to simulate removal)
    const firstChange = makePlan([
      { dayIndex: 2, mealType: MealSlot.LUNCH, mealId: 999 }, // changed
      { dayIndex: 1, mealType: MealSlot.DINNER, mealId: 2 }, // unchanged
    ]);

    act(() => {
      (globalThis as unknown as { __harness: { applyHighlights: (p: MealPlan) => void } }).__harness.applyHighlights(firstChange);
    });

    // Should highlight wednesday lunch
    let highlights: Set<string> = (globalThis as unknown as {
      __harness: { getHighlights: () => Set<string> };
    }).__harness.getHighlights();
    expect(highlights.has('2-lunch')).toBe(true);
    expect(highlights.has('1-dinner')).toBe(false);
    expect(highlights.size).toBe(1);

    // Second change: Swap dinner on tuesday (before first timeout clears)
    const secondChange = makePlan([
      { dayIndex: 2, mealType: MealSlot.LUNCH, mealId: 999 }, // still different from original
      { dayIndex: 1, mealType: MealSlot.DINNER, mealId: 555 }, // changed
    ]);

    act(() => {
      (globalThis as unknown as { __harness: { applyHighlights: (p: MealPlan) => void } }).__harness.applyHighlights(secondChange);
    });

    // Should only highlight tuesday dinner, not wednesday lunch
    highlights = (globalThis as unknown as {
      __harness: { getHighlights: () => Set<string> };
    }).__harness.getHighlights();
    expect(highlights.has('1-dinner')).toBe(true);
    expect(highlights.has('2-lunch')).toBe(false); // This should NOT be highlighted
    expect(highlights.size).toBe(1);
  });

  it('cleans up pending timeout on unmount', () => {
    const base = makePlan([
      { dayIndex: 0, mealType: MealSlot.DINNER, mealId: 1 },
    ]);
    const { unmount } = render(<HookHarness initialPlan={base} />);
    const spy = jest.spyOn(window, 'clearTimeout');

    const newPlan = makePlan([
      { dayIndex: 0, mealType: MealSlot.DINNER, mealId: 2 },
    ]);
    act(() => {
      (globalThis as unknown as { __harness: { applyHighlights: (p: MealPlan) => void } }).__harness.applyHighlights(newPlan);
    });
    expect(screen.getByTestId('highlight-count').textContent).toBe('1');

    unmount();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
