import {
  Meal,
  Ingredient,
  Step,
  GetAllMealsResponse,
  CreateMealRequest,
  CreateMealResponse,
  DeleteMealRequest,
  DeleteMealResponse,
  UpdateMealIngredientRequest,
  UpdateMealIngredientResponse,
  DeleteMealIngredientRequest,
  DeleteMealIngredientResponse,
  AddBulkStepsRequest,
  AddBulkStepsResponse,
  DeleteAllStepsRequest,
  DeleteAllStepsResponse,
} from '@mealplanner/generated';

/**
 * Fetch all meals, optionally filtered by type
 */
export async function getMeals(mealType?: string): Promise<Meal[]> {
  let url = '/api/meals';
  if (mealType) {
    url += `?type=${mealType.toLowerCase()}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch meals: ${response.statusText}`);
  }

  const responseJson = await response.json();
  const data = GetAllMealsResponse.fromJSON(responseJson);
  return data.meals;
}

/**
 * Create a new meal
 */
export async function createMeal(meal: Omit<Meal, 'id'>): Promise<Meal> {
  const mealData: Meal = {
    id: 0, // Will be assigned by backend
    ...meal,
  };

  const requestData: CreateMealRequest = {
    meal: mealData,
  };

  const response = await fetch('/api/meals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CreateMealRequest.toJSON(requestData)),
  });

  if (!response.ok) {
    throw new Error(`Failed to create meal: ${response.statusText}`);
  }

  const responseJson = await response.json();
  const data = CreateMealResponse.fromJSON(responseJson);

  if (!data.meal) {
    throw new Error('No meal returned from create request');
  }

  return data.meal;
}

/**
 * Delete a meal
 */
export async function deleteMeal(mealId: number): Promise<string> {
  const requestData: DeleteMealRequest = {
    mealId,
  };

  const response = await fetch(`/api/meals/${mealId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(DeleteMealRequest.toJSON(requestData)),
  });

  if (!response.ok) {
    throw new Error(`Failed to delete meal: ${response.statusText}`);
  }

  const responseJson = await response.json();
  const data = DeleteMealResponse.fromJSON(responseJson);
  return data.message;
}

/**
 * Update an ingredient in a meal
 */
export async function updateMealIngredient(
  mealId: number,
  ingredientId: number,
  ingredient: Ingredient,
): Promise<Meal> {
  const requestData: UpdateMealIngredientRequest = {
    mealId,
    ingredientId,
    ingredient,
  };

  const response = await fetch(
    `/api/meals/${mealId}/ingredients/${ingredientId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(UpdateMealIngredientRequest.toJSON(requestData)),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to update ingredient: ${response.statusText}`);
  }

  const responseJson = await response.json();
  const data = UpdateMealIngredientResponse.fromJSON(responseJson);

  if (!data.meal) {
    throw new Error('No meal returned from update request');
  }

  return data.meal;
}

/**
 * Delete an ingredient from a meal
 */
export async function deleteMealIngredient(
  mealId: number,
  ingredientId: number,
): Promise<Meal> {
  const requestData: DeleteMealIngredientRequest = {
    mealId,
    ingredientId,
  };

  const response = await fetch(
    `/api/meals/${mealId}/ingredients/${ingredientId}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DeleteMealIngredientRequest.toJSON(requestData)),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to delete ingredient: ${response.statusText}`);
  }

  const responseJson = await response.json();
  const data = DeleteMealIngredientResponse.fromJSON(responseJson);

  if (!data.meal) {
    throw new Error('No meal returned from delete request');
  }

  return data.meal;
}

/**
 * Add multiple steps to a meal in bulk
 */
export async function addBulkSteps(
  mealId: number,
  instructions: string[],
): Promise<Step[]> {
  const requestData: AddBulkStepsRequest = {
    mealId,
    instructions,
  };

  const response = await fetch(`/api/meals/${mealId}/steps/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(AddBulkStepsRequest.toJSON(requestData)),
  });

  if (!response.ok) {
    throw new Error(`Failed to add steps: ${response.statusText}`);
  }

  const responseJson = await response.json();
  const data = AddBulkStepsResponse.fromJSON(responseJson);
  return data.steps;
}

/**
 * Delete all steps from a meal
 */
export async function deleteAllSteps(mealId: number): Promise<string> {
  const requestData: DeleteAllStepsRequest = {
    mealId,
  };

  const response = await fetch(`/api/meals/${mealId}/steps`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(DeleteAllStepsRequest.toJSON(requestData)),
  });

  if (!response.ok) {
    throw new Error(`Failed to delete steps: ${response.statusText}`);
  }

  const responseJson = await response.json();
  const data = DeleteAllStepsResponse.fromJSON(responseJson);
  return data.message;
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
