// Re-export common types from the shared package
export type {
  MealType,
  Ingredient,
  Step,
  Meal,
  ShoppingListItem,
} from '@meal-planner/shared/dist/types';

export interface MealPlan {
  [day: string]: Meal;
}

// Define the response type when swapping a meal
export interface SwapMealResponse {
  day: string;
  new_meal_id: number;
  meal_name: string;
}

// If needed, you can add more types for your API endpoints (e.g., for finalize, shopping list, etc.)
