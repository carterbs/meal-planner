import type {
  MainMealResponse,
  MainStepResponse,
  MainIngredientResponse,
  MainShoppingListItemResponse,
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
import { Meal, Ingredient, Step, WeeklyMealPlan } from '../types';

// Create the API gateway client

/**
 * Map MainStepResponse to UI Step
 */
function mapStep(s: MainStepResponse): Step {
  return {
    id: s.id,
    mealId: s.mealId,
    stepNumber: s.stepNumber,
    instruction: s.instruction || '',
  };
}

/**
 * Map MainMealResponse to UI Meal
 */
function mapMeal(m: MainMealResponse): Meal {
  return {
    id: m.id,
    name: m.name || '',
    effort: m.effort || 0,
    hasRedMeat: m.hasRedMeat || false,
    url: m.url || '',
    mealType: m.mealType || '',
    ingredients: (m.ingredients || []).map((i) => ({
      id: i.id,
      mealId: i.mealId,
      name: i.name || '',
      quantity: i.quantity || 0,
      unit: i.unit || '',
    })),
    steps: (m.steps || []).map(mapStep),
  };
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
  meal: Omit<MainMealResponse, 'id'>,
): Promise<Meal> {
  const mealData = {
    id: 0, // Will be assigned by backend
    ...meal,
  };

  const result = await postMeals({
    client: gatewayClient,
    body: { meal: mealData },
  });

  if (!result.data || result.error) {
    const errorMessage = result.error?.error || result.error || 'Unknown error';
    throw new Error(`Failed to create meal: ${errorMessage}`);
  }

  if (!result.data) {
    throw new Error('No meal returned from create request');
  }

  return mapMeal(result.data);
}

/**
 * Update an existing meal
 */
export async function updateMeal(
  mealId: number,
  meal: MainMealResponse,
): Promise<Meal> {
  const result = await putMealsByMealId({
    client: gatewayClient,
    path: { mealId: mealId },
    body: {
      meal_id: mealId,
      meal,
    },
  });

  if (!result.data || result.error) {
    const errorMessage = result.error?.error || result.error || 'Unknown error';
    throw new Error(`Failed to update meal: ${errorMessage}`);
  }

  return mapMeal(result.data);
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
  ingredient: MainIngredientResponse,
): Promise<Meal> {
  const result = await putMealsByMealIdIngredientsByIngredientId({
    client: gatewayClient,
    path: { mealId: mealId.toString(), ingredientId: ingredientId.toString() },
    body: {
      ingredient,
      ingredient_id: ingredientId,
      meal_id: mealId,
    },
  });

  if (!result.data || result.error) {
    throw new Error(
      `Failed to update ingredient: ${result.error || 'Unknown error'}`,
    );
  }

  return mapMeal(result.data);
}

/**
 * Create a new ingredient for a meal
 */
export async function createMealIngredient(
  mealId: number,
  ingredient: MainIngredientResponse,
): Promise<Meal> {
  const result = await postMealsByMealIdIngredients({
    client: gatewayClient,
    path: { mealId: mealId.toString() },
    body: {
      ingredient,
      meal_id: mealId,
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

  return mapMeal(result.data.meal);
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

  return mapMeal(result.data);
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

export async function goGetShoppingList(mealPlan: WeeklyMealPlan): Promise<MainShoppingListItemResponse[]> {
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