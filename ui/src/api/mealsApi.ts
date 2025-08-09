import type {
  GoMeal,
  GoStep,
  GoIngredient,
  GoShoppingListItem,
} from '@mealplanner/generated/dist/gateway/types.gen';
import {
  createClient,
  createConfig,
} from '@mealplanner/generated/dist/gateway/client/index.js';
import {
  getMeals as getMealsFromGateway,
  postMeals,
  putMealsByMealId,
  deleteMealsByMealId,
  postMealsByMealIdIngredients,
  putMealsByMealIdIngredientsByIngredientId,
  deleteMealsByMealIdIngredientsByIngredientId,
  postMealsByMealIdStepsBulk,
  deleteMealsByMealIdSteps,
  postShoppinglist,
  GoGetShoppingListRequest,
} from '@mealplanner/generated/dist/gateway/index.js';
import { Meal, Step, Ingredient } from '@mealplanner/generated';
import type { WeeklyMealPlan } from '@mealplanner/generated';
import { Timestamp } from '@bufbuild/protobuf';

// Create the API gateway client

/**
 * Map GoStep to UI Step
 */
function mapStep(s: GoStep): Step {
  return new Step({
    id: s.id || 0,
    mealId: s.mealId || 0,
    stepNumber: s.stepNumber || 0,
    instruction: s.instruction || '',
  });
}

/**
 * Map GoIngredient to UI Ingredient
 */
function mapIngredient(i: GoIngredient): Ingredient {
  return new Ingredient({
    id: i.id || 0,
    mealId: i.mealId || 0,
    name: i.name || '',
    quantity: i.quantity || 0,
    unit: i.unit || '',
  });
}

/**
 * Map GoMeal to UI Meal
 */
function mapMeal(m: GoMeal): Meal {
  // Convert lastPlanned to protobuf Timestamp if present and string-like
  let lastPlannedTimestamp: Timestamp | undefined;
  const maybeLastPlanned: unknown = (m as any).lastPlanned;
  if (typeof maybeLastPlanned === 'string' && maybeLastPlanned) {
    const date = new Date(maybeLastPlanned);
    if (!isNaN(date.getTime())) {
      lastPlannedTimestamp = Timestamp.fromDate(date);
    }
  }

  return new Meal({
    id: m.id || 0,
    name: m.name || '',
    effort: m.effort || 0,
    lastPlanned: lastPlannedTimestamp,
    hasRedMeat: m.hasRedMeat || false,
    url: m.url || '',
    mealType: m.mealType || '',
    ingredients: (m.ingredients || []).map(mapIngredient),
    steps: (m.steps || []).map(mapStep),
  });
}

// Create the API gateway client
const gatewayClient = createClient(
  createConfig({
    baseUrl: 'http://localhost:8090/api',
  }),
);

/**
 * Fetch all meals, optionally filtered by type
 */
export async function getMeals(mealType?: string): Promise<Meal[]> {
  const query = mealType ? { type: mealType.toLowerCase() } : undefined;

  const result = await getMealsFromGateway({
    client: gatewayClient,
    query,
  });

  if (!result.data || result.error) {
    throw new Error(
      `Failed to fetch meals: ${result.error || 'Unknown error'}`,
    );
  }

  return (result.data.meals || []).map(mapMeal);
}

/**
 * Create a new meal
 */
export async function createMeal(
  mealData: Omit<GoMeal, 'id'>,
): Promise<Meal> {
  const mealPayload = {
    id: 0, // Will be assigned by backend
    ...mealData,
  };

  const result = await postMeals({
    client: gatewayClient,
    body: { meal: mealPayload },
  });

  if (!result.data || result.error) {
    const errorMessage = result.error?.error || result.error || 'Unknown error';
    throw new Error(`Failed to create meal: ${errorMessage}`);
  }

  if (!result.data || !result.data.meal) {
    throw new Error('No meal returned from create request');
  }

  // Parse the meal from string if needed
  const parsedMeal = typeof result.data.meal === 'string' ? JSON.parse(result.data.meal) : result.data.meal;
  return mapMeal(parsedMeal);
}

/**
 * Update an existing meal
 */
export async function updateMeal(
  mealId: number,
  mealData: GoMeal,
): Promise<Meal> {
  const result = await putMealsByMealId({
    client: gatewayClient,
    path: { mealId: mealId },
    body: {
      mealId: mealId,
      meal: mealData,
    },
  });

  if (!result.data || result.error) {
    const errorMessage = result.error?.error || result.error || 'Unknown error';
    throw new Error(`Failed to update meal: ${errorMessage}`);
  }

  if (!result.data.meal) {
    throw new Error('No meal returned from update request');
  }

  // Parse the meal from string if needed
  const parsedMeal = typeof result.data.meal === 'string' ? JSON.parse(result.data.meal) : result.data.meal;
  return mapMeal(parsedMeal);
}

/**
 * Delete a meal
 */
export async function deleteMeal(mealId: number): Promise<string> {
  const result = await deleteMealsByMealId({
    client: gatewayClient,
    path: { mealId: mealId.toString() },
  });

  if (!result.data || result.error) {
    throw new Error(
      `Failed to delete meal: ${result.error || 'Unknown error'}`,
    );
  }

  return result.data.message || 'Meal deleted successfully';
}

/**
 * Update an ingredient in a meal
 */
export async function updateMealIngredient(
  mealId: number,
  ingredientId: number,
  ingredient: GoIngredient,
): Promise<Meal> {
  const result = await putMealsByMealIdIngredientsByIngredientId({
    client: gatewayClient,
    path: { mealId: mealId.toString(), ingredientId: ingredientId.toString() },
    body: {
      ingredient: ingredient,
      ingredientId: ingredientId,
      mealId: mealId,
    },
  });

  if (!result.data || result.error) {
    throw new Error(
      `Failed to update ingredient: ${result.error || 'Unknown error'}`,
    );
  }

  if (!result.data.meal) {
    throw new Error('No meal returned from update ingredient request');
  }

  // Parse the meal from string if needed
  const parsedMeal = typeof result.data.meal === 'string' ? JSON.parse(result.data.meal) : result.data.meal;
  return mapMeal(parsedMeal);
}

/**
 * Create a new ingredient for a meal
 */
export async function createMealIngredient(
  mealId: number,
  ingredient: GoIngredient,
): Promise<Meal> {
  const result = await postMealsByMealIdIngredients({
    client: gatewayClient,
    path: { mealId: mealId.toString() },
    body: {
      ingredient: ingredient,
      mealId: mealId,
    },
  });

  if (!result.data || result.error) {
    throw new Error(
      `Failed to create ingredient: ${result.error || 'Unknown error'}`,
    );
  }

  if (!result.data.meal) {
    throw new Error('No meal returned from create ingredient request');
  }

  // Parse the meal from string if needed
  const parsedMeal = typeof result.data.meal === 'string' ? JSON.parse(result.data.meal) : result.data.meal;
  return mapMeal(parsedMeal);
}

/**
 * Delete an ingredient from a meal
 */
export async function deleteMealIngredient(
  mealId: number,
  ingredientId: number,
): Promise<Meal> {
  const result = await deleteMealsByMealIdIngredientsByIngredientId({
    client: gatewayClient,
    path: { mealId: mealId.toString(), ingredientId: ingredientId.toString() },
  });

  if (!result.data || result.error) {
    throw new Error(
      `Failed to delete ingredient: ${result.error || 'Unknown error'}`,
    );
  }

  if (!result.data.meal) {
    throw new Error('No meal returned from delete ingredient request');
  }

  // Parse the meal from string if needed
  const parsedMeal = typeof result.data.meal === 'string' ? JSON.parse(result.data.meal) : result.data.meal;
  return mapMeal(parsedMeal);
}

/**
 * Add multiple steps to a meal in bulk
 */
export async function addBulkSteps(
  mealId: number,
  instructions: string[],
): Promise<Step[]> {
  const result = await postMealsByMealIdStepsBulk({
    client: gatewayClient,
    path: { mealId: mealId.toString() },
    body: { instructions },
  });

  if (!result.data || result.error) {
    throw new Error(`Failed to add steps: ${result.error || 'Unknown error'}`);
  }

  return (result.data.steps || []).map(mapStep);
}

/**
 * Delete all steps from a meal
 */
export async function deleteAllSteps(mealId: number): Promise<string> {
  const result = await deleteMealsByMealIdSteps({
    client: gatewayClient,
    path: { mealId: mealId.toString() },
  });

  if (!result.data || result.error) {
    throw new Error(
      `Failed to delete steps: ${result.error || 'Unknown error'}`,
    );
  }

  return result.data.message || 'Steps deleted successfully';
}

/**
 * Replace all steps for a meal (delete all, then add new ones)
 */
export async function replaceAllSteps(
  mealId: number,
  steps: Step[],
): Promise<void> {
  // Delete existing steps first
  await deleteAllSteps(mealId);

  // Add new steps if there are any
  if (steps.length > 0) {
    const instructions = steps.map((step) => step.instruction);
    await addBulkSteps(mealId, instructions);
  }
}

export async function goGetShoppingList(mealPlan: WeeklyMealPlan): Promise<GoShoppingListItem[]> {
  const request: GoGetShoppingListRequest = {
    plan: mealPlan.days.filter((day) => day.meal).map((day) => day.meal!.id),
  };
  const result = await postShoppinglist({
    client: gatewayClient,
    body: request,
  });

  if (!result.data || !result.data.items || result.error) {
    throw new Error(
      `Failed to generate shopping list: ${result.error || 'Unknown error'}`,
    );
  }

  return result.data.items;
}