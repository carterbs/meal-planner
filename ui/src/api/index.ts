/* istanbul ignore file -- barrel file with no runtime logic */
// Export all API services
export * from './agentApi';
export * from './mealsApi';

// Re-export commonly used types for convenience
export type {
  Meal,
  Ingredient,
  Step,
  MealPlan,
  ShoppingListItem,
} from '@mealplanner/generated/api_pb';
