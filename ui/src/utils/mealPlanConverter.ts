import { MealPlan } from '@mealplanner/generated/api_pb';
import type { JsonValue } from '@bufbuild/protobuf';

export function convertGatewayMealPlan(plan: unknown): MealPlan {
  if (plan == null) {
    return new MealPlan({ items: [] });
  }

  try {
    return MealPlan.fromJson(plan as JsonValue, {
      ignoreUnknownFields: true,
    });
  } catch (err) {
    console.error('Failed to convert gateway meal plan', err);
    return new MealPlan({ items: [] });
  }
}
