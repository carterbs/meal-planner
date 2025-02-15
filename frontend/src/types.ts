// frontend/src/types.ts

// Define the overall MealPlan type (mapping day to meal description)
export interface MealPlan {
    [day: string]: string;
}

// Define the response type when swapping a meal
export interface SwapMealResponse {
    day: string;
    new_meal_id: number;
    meal_name: string;
}

// If needed, you can add more types for your API endpoints (e.g., for finalize, shopping list, etc.)