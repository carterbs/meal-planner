import React, { PropsWithChildren, useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import { WeeklyMealPlan, MealPlanEntry, Meal } from '@mealplanner/generated';
import useMealPlanHighlights from './useMealPlanHighlights';

function makePlan(entries: Array<{ dayIndex: number; mealType: string; mealId: number }>): WeeklyMealPlan {
    const days = entries.map(
        (e) => new MealPlanEntry({ dayIndex: e.dayIndex, mealType: e.mealType, meal: new Meal({ id: e.mealId, name: `Meal ${e.mealId}`, effort: 1 }) }),
    );
    return new WeeklyMealPlan({ days });
}

function HookHarness({ initialPlan }: PropsWithChildren<{ initialPlan: WeeklyMealPlan | null }>) {
    const [plan, setPlan] = useState<WeeklyMealPlan | null>(initialPlan);
    const { highlights, applyHighlights, resetHighlights } = useMealPlanHighlights(plan, (p) => setPlan(p));

    // Expose controls for tests
     
    (global as any).__harness = { setPlan, applyHighlights, resetHighlights, getHighlights: () => highlights, getPlan: () => plan };

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
         
        delete (global as any).__harness;
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
             
            (global as any).__harness.applyHighlights(newPlan);
        });

        const count = screen.getByTestId('highlight-count');
        expect(count.textContent).toBe('1');
         
        const highlights: Set<string> = (global as any).__harness.getHighlights();
        expect(highlights.has('0-breakfast')).toBe(true);

        // plan should be updated
        const planSize = screen.getByTestId('plan-size');
        expect(planSize.textContent).toBe('2');
    });

    it('auto clears changed highlights after 5s', () => {
        const base = makePlan([
            { dayIndex: 1, mealType: 'dinner', mealId: 2 },
        ]);

        render(<HookHarness initialPlan={base} />);

        const newPlan = makePlan([
            { dayIndex: 1, mealType: 'dinner', mealId: 5 }, // changed
        ]);

        act(() => {
             
            (global as any).__harness.applyHighlights(newPlan);
        });

        expect(screen.getByTestId('highlight-count').textContent).toBe('1');

        act(() => {
            jest.advanceTimersByTime(5000);
        });

        expect(screen.getByTestId('highlight-count').textContent).toBe('0');
    });

    it('resetHighlights clears all current highlights', () => {
        const base = makePlan([
            { dayIndex: 2, mealType: 'lunch', mealId: 9 },
        ]);

        render(<HookHarness initialPlan={base} />);

        const newPlan = makePlan([
            { dayIndex: 2, mealType: 'lunch', mealId: 10 },
        ]);

        act(() => {
             
            (global as any).__harness.applyHighlights(newPlan);
        });

        expect(screen.getByTestId('highlight-count').textContent).toBe('1');

        act(() => {
             
            (global as any).__harness.resetHighlights();
        });

        expect(screen.getByTestId('highlight-count').textContent).toBe('0');
    });
});
