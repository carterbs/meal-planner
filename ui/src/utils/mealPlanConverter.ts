import { MealPlan } from '@mealplanner/generated/api_pb';
import { parseMealPlan } from './gatewayGuards';

export function convertGatewayMealPlan(plan: unknown): MealPlan {
  try {
    return parseMealPlan(plan);
  } catch (err) {
    console.error('Failed to convert gateway meal plan', err);
    return new MealPlan({ items: [] });
  }
}
