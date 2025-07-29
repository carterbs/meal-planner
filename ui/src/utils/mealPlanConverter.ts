import {
  Meal,
  Ingredient,
  Step,
  MealPlanEntry,
  WeeklyMealPlan,
} from '@mealplanner/generated';
import type {
  GoMealPlanEntry,
  GoMeal,
  GoIngredient,
  GoStep,
} from '@mealplanner/generated/dist/gateway/types.gen';
import { Timestamp } from '@bufbuild/protobuf';

/**
 * Convert a list of GoMealPlanEntry objects (from the REST gateway)
 * into a protobuf WeeklyMealPlan instance that the UI / gRPC layer expects.
 */
export function convertGatewayMealPlan(
  mealPlan: { days?: GoMealPlanEntry[] } | undefined,
): WeeklyMealPlan {
  const entries: GoMealPlanEntry[] = mealPlan?.days ?? [];

  const convertedEntries: MealPlanEntry[] = entries.map((e) => {
    const meal = e.meal ? convertMeal(e.meal) : undefined;
    return new MealPlanEntry({
      dayIndex: e.dayIndex ?? 0,
      mealType: e.mealType ?? '',
      meal,
    });
  });

  return new WeeklyMealPlan({
    days: convertedEntries,
  });
}

function convertMeal(meal: GoMeal): Meal {
  return new Meal({
    id: meal.id ?? 0,
    name: meal.name ?? '',
    effort: meal.effort ?? 0,
    hasRedMeat: meal.hasRedMeat ?? false,
    url: meal.url ?? '',
    mealType: meal.mealType ?? '',
    lastPlanned: meal.lastPlanned
      ? Timestamp.fromDate(new Date((meal.lastPlanned.seconds ?? 0) * 1000))
      : undefined,
    ingredients: (meal.ingredients ?? []).map(convertIngredient),
    steps: (meal.steps ?? []).map(convertStep),
  });
}

function convertIngredient(i: GoIngredient): Ingredient {
  return new Ingredient({
    id: i.id ?? 0,
    mealId: i.mealId ?? 0,
    name: i.name ?? '',
    quantity: i.quantity ?? 0,
    unit: i.unit ?? '',
  });
}

function convertStep(s: GoStep): Step {
  return new Step({
    id: s.id ?? 0,
    mealId: s.mealId ?? 0,
    stepNumber: s.stepNumber ?? 0,
    instruction: s.instruction ?? '',
  });
} 