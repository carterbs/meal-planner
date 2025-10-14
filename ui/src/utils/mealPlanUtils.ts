import type { MealPlan, MealPlanEntry } from '@mealplanner/generated/api_pb';
import { planToEntries as basePlanToEntries } from './gatewayGuards';

export function planToEntries(plan?: MealPlan | null): MealPlanEntry[] {
  return basePlanToEntries(plan);
}
