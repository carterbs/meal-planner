import { useCallback, useEffect, useRef, useState } from 'react';
import { MealPlan } from '@mealplanner/generated/api_pb';
import { planToEntries } from '../utils/mealPlanUtils';

export default function useMealPlanHighlights(
  currentPlan: MealPlan | null,
  setPlan: (plan: MealPlan) => void,
): {
  highlights: Set<string>;
  applyHighlights: (newPlan: MealPlan) => void;
  resetHighlights: () => void;
} {
  const [highlights, setHighlights] = useState<Set<string>>(new Set());
  const previousPlanRef = useRef<MealPlan | null>(currentPlan);
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
    (
      prevPlan: MealPlan | null,
      nextPlan: MealPlan | null,
    ): Set<string> => {
      const changed = new Set<string>();
      if (!prevPlan || !nextPlan) {
        return changed;
      }
      const prevEntries = planToEntries(prevPlan);
      const nextEntries = planToEntries(nextPlan);
      const prevMap = new Map<string, number | null>();
      prevEntries.forEach((entry) => {
        const key = `${entry.dayIndex}-${entry.mealType}`;
        const mealId =
          typeof entry.meal?.id === 'number' ? entry.meal.id : null;
        prevMap.set(key, mealId);
      });

      nextEntries.forEach((entry) => {
        const key = `${entry.dayIndex}-${entry.mealType}`;
        const prevId = prevMap.get(key) ?? null;
        const nextId =
          typeof entry.meal?.id === 'number' ? entry.meal.id : null;
        if (prevId !== nextId) {
          changed.add(key);
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
      // Clear any existing timeout since we're replacing highlights
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      // Replace highlights with only the most recent changes
      setHighlights(new Set(changed));
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
    (newPlan: MealPlan) => {
      const prevPlan = previousPlanRef.current;
      const changed = computeChangedKeys(prevPlan, newPlan);
      if (changed.size > 0) {
        // Clear any existing timeout since we're replacing highlights
        if (timeoutRef.current) {
          window.clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        // Replace highlights with only the most recent changes
        setHighlights(new Set(changed));
        scheduleClear(changed);
      }

      // Set plan after computing highlights to preserve original behavior
      setPlan(newPlan);
      // Update previous plan reference to the new plan
      previousPlanRef.current = newPlan;
    },
    [setPlan, computeChangedKeys, scheduleClear],
  );

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  return { highlights, applyHighlights, resetHighlights };
}
