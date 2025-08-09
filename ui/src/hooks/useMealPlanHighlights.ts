import { useCallback, useEffect, useRef, useState } from 'react';
import { WeeklyMealPlan } from '@mealplanner/generated';

export default function useMealPlanHighlights(
    currentPlan: WeeklyMealPlan | null,
    setPlan: (plan: WeeklyMealPlan) => void,
): {
    highlights: Set<string>;
    applyHighlights: (newPlan: WeeklyMealPlan) => void;
    resetHighlights: () => void;
} {
    const [highlights, setHighlights] = useState<Set<string>>(new Set());
    const previousPlanRef = useRef<WeeklyMealPlan | null>(currentPlan);
    const timeoutRef = useRef<number | null>(null);

    const scheduleClear = useCallback((keys: Set<string>) => {
        if (keys.size === 0) return;
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = window.setTimeout(() => {
            setHighlights((h) => {
                const copy = new Set(h);
                keys.forEach((k) => copy.delete(k));
                return copy;
            });
            timeoutRef.current = null;
        }, 5000);
    }, []);

    const computeChangedKeys = useCallback(
        (prevPlan: WeeklyMealPlan | null, nextPlan: WeeklyMealPlan | null): Set<string> => {
            const changed = new Set<string>();
            if (!prevPlan || !nextPlan) {
                return changed;
            }
            nextPlan.days.forEach((d) => {
                const prevEntry = prevPlan.days.find(
                    (p) => p.dayIndex === d.dayIndex && p.mealType === d.mealType,
                );
                const prevId = prevEntry?.meal ? prevEntry.meal.id : null;
                const newId = d.meal ? d.meal.id : null;
                if (prevId !== newId) {
                    changed.add(`${d.dayIndex}-${d.mealType}`);
                }
            });
            return changed;
        },
        [],
    );

    // Keep previous plan ref in sync when current plan changes externally
    useEffect(() => {
        // If plan changed externally (not through applyHighlights), compute diffs and highlight
        const prev = previousPlanRef.current;
        const next = currentPlan;
        const changed = computeChangedKeys(prev, next);
        if (changed.size > 0) {
            setHighlights((prevSet) => new Set([...prevSet, ...changed]));
            scheduleClear(changed);
        }
        previousPlanRef.current = currentPlan;
    }, [currentPlan, computeChangedKeys, scheduleClear]);

    const resetHighlights = useCallback(() => {
        setHighlights(new Set());
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const applyHighlights = useCallback(
        (newPlan: WeeklyMealPlan) => {
            const prevPlan = previousPlanRef.current;
            const changed = computeChangedKeys(prevPlan, newPlan);
            if (changed.size > 0) {
                setHighlights((prev) => new Set([...prev, ...changed]));
                scheduleClear(changed);
            }

            // Set plan after computing highlights to preserve original behavior
            setPlan(newPlan);
            // Update previous plan reference to the new plan
            previousPlanRef.current = newPlan;
        },
        [setPlan, computeChangedKeys, scheduleClear],
    );

    useEffect(() => () => {
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
        }
    }, []);

    return { highlights, applyHighlights, resetHighlights };
}
