export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface Ingredient {
  Name: string;
  Quantity: number;
  Unit: string;
  ID: number;
}

export interface Step {
  id: number;
  mealId: number;
  stepNumber: number;
  instruction: string;
}

export interface Meal {
  id: number;
  mealName: string;
  relativeEffort: number;
  lastPlanned: string;
  redMeat: boolean;
  url?: string;
  mealType: MealType;
  ingredients: Ingredient[];
  steps?: Step[];
}

export interface MealInfo {
  id: number;
  name: string;
  effort: number;
  hasRedMeat: boolean;
}

export interface PlanDay {
  dayIndex: number;
  mealType: string;
  meal: MealInfo | null;
}

export interface WeeklyMealPlan {
  id?: number;
  days: PlanDay[];
}

export interface ShoppingListItem {
  ingredient: string;
  quantity: string;
  category?: string;
}
