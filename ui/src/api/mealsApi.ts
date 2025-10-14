import type {
  GoMeal,
  GoStep,
  GoIngredient,
  GoShoppingListItem,
} from '@mealplanner/generated/gateway/types.gen';
import {
  createClient,
  createConfig,
} from '@mealplanner/generated/gateway/client';
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
} from '@mealplanner/generated/gateway';
import { Meal, Step, Ingredient, MealPlan } from '@mealplanner/generated/api_pb';
import { Timestamp } from '@bufbuild/protobuf';

// Create the API gateway client

function formatGatewayError(err: unknown): string {
  if (typeof err === 'string') return err;
  const maybeObj = err as { error?: unknown } | undefined;
  const nested = maybeObj && typeof maybeObj === 'object' ? maybeObj.error : undefined;
  if (typeof nested === 'string') return nested;
  if (err != null) return String(err);
  return 'Unknown error';
}

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
  const maybeLastPlanned: unknown = m.lastPlanned;
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
    ingredients: (m.ingredients || []).map((ing: GoIngredient) => mapIngredient(ing)),
    steps: (m.steps || []).map((st: GoStep) => mapStep(st)),
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

  const res = result as unknown as { data?: { meals?: unknown[] | null }; error?: unknown };
  if (!res.data || res.error) {
    throw new Error(`Failed to fetch meals: ${formatGatewayError(res.error)}`);
  }

  return ((res.data.meals || []) as GoMeal[]).map((m: GoMeal) => mapMeal(m));
}

/**
 * Create a new meal
 */
export async function createMeal(mealData: Omit<GoMeal, 'id'>): Promise<Meal> {
  const mealPayload = {
    id: 0, // Will be assigned by backend
    ...mealData,
  };

  const result = await postMeals({
    client: gatewayClient,
    body: { meal: mealPayload },
  });

  const res = result as unknown as { data: string; error?: unknown };
  
  if (res.error) {
    throw new Error(`Failed to create meal: ${formatGatewayError(res.error)}`);
  }

  // HTTP client returns JSON string in data field - parse it
  let parsed: unknown;
  try {
    parsed = JSON.parse(res.data);
  } catch (parseError) {
    throw new Error(`Failed to parse meal response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }

  // Type guard to ensure parsed response has the expected structure
  if (!parsed || typeof parsed !== 'object' || !('meal' in parsed) || !parsed.meal) {
    throw new Error('No meal returned from create request');
  }

  return mapMeal(parsed.meal as GoMeal);
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

  const res = result as unknown as { data?: { meal?: unknown }; error?: unknown };
  if (!res.data || res.error) {
    throw new Error(`Failed to update meal: ${formatGatewayError(res.error)}`);
  }

  if (!res.data.meal) {
    throw new Error('No meal returned from update request');
  }

  // Parse the meal from string if needed
  const parsedMeal: GoMeal =
    typeof res.data.meal === 'string'
      ? (JSON.parse(res.data.meal) as GoMeal)
      : (res.data.meal as GoMeal);
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

  const res = result as unknown as { data?: { message?: string }; error?: unknown };
  if (!res.data || res.error) {
    throw new Error(`Failed to delete meal: ${formatGatewayError(res.error)}`);
  }

  return res.data.message || 'Meal deleted successfully';
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

  const res = result as unknown as { data?: { meal?: unknown }; error?: unknown };
  if (!res.data || res.error) {
    throw new Error(`Failed to update ingredient: ${formatGatewayError(res.error)}`);
  }

  if (!res.data.meal) {
    throw new Error('No meal returned from update ingredient request');
  }

  // Parse the meal from string if needed
  const parsedMeal: GoMeal =
    typeof res.data.meal === 'string'
      ? (JSON.parse(res.data.meal) as GoMeal)
      : (res.data.meal as GoMeal);
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

  const res = result as unknown as { data?: { meal?: unknown }; error?: unknown };
  if (!res.data || res.error) {
    throw new Error(`Failed to create ingredient: ${formatGatewayError(res.error)}`);
  }

  if (!res.data.meal) {
    throw new Error('No meal returned from create ingredient request');
  }

  // Parse the meal from string if needed
  const parsedMeal: GoMeal =
    typeof res.data.meal === 'string'
      ? (JSON.parse(res.data.meal) as GoMeal)
      : (res.data.meal as GoMeal);
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

  const res = result as unknown as { data?: { meal?: unknown }; error?: unknown };
  if (!res.data || res.error) {
    throw new Error(`Failed to delete ingredient: ${formatGatewayError(res.error)}`);
  }

  if (!res.data.meal) {
    throw new Error('No meal returned from delete ingredient request');
  }

  // Parse the meal from string if needed
  const parsedMeal: GoMeal =
    typeof res.data.meal === 'string'
      ? (JSON.parse(res.data.meal) as GoMeal)
      : (res.data.meal as GoMeal);
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

  const res = result as unknown as { data?: { steps?: unknown[] | null }; error?: unknown };
  if (!res.data || res.error) {
    throw new Error(`Failed to add steps: ${formatGatewayError(res.error)}`);
  }

  return ((res.data.steps || []) as GoStep[]).map((s: GoStep) => mapStep(s));
}

/**
 * Delete all steps from a meal
 */
export async function deleteAllSteps(mealId: number): Promise<string> {
  const result = await deleteMealsByMealIdSteps({
    client: gatewayClient,
    path: { mealId: mealId.toString() },
  });

  const res = result as unknown as { data?: { message?: string }; error?: unknown };
  if (!res.data || res.error) {
    throw new Error(`Failed to delete steps: ${formatGatewayError(res.error)}`);
  }

  return res.data.message || 'Steps deleted successfully';
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

export async function goGetShoppingList(
  mealPlan: MealPlan,
): Promise<GoShoppingListItem[]> {
  const plan = mealPlan.items
    .map((item) => {
      if (typeof item.mealId === 'number' && item.mealId > 0) {
        return item.mealId;
      }
      const snapshotId = item.mealSnapshot?.id;
      return typeof snapshotId === 'number' && snapshotId > 0 ? snapshotId : undefined;
    })
    .filter((id): id is number => id !== undefined);

  const result = await postShoppinglist({
    client: gatewayClient,
    body: { plan },
  });

  if (result.error) {
    throw new Error(`Failed to generate shopping list: ${formatGatewayError(result.error)}`);
  }

  const data = result.data;
  if (!data) {
    throw new Error('Failed to generate shopping list: empty response');
  }

  const items = data.items;
  if (!items) {
    throw new Error('Failed to generate shopping list: empty response');
  }

  return items;
}
