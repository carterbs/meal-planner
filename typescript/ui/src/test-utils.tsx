import React from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { Meal, WeeklyMealPlan, Ingredient } from './types';

// Extended meal plan interface for the new structure
interface ExtendedMealPlan {
  [day: string]: {
    [mealType: string]: Meal | null;
  };
}

// Shared mock data for tests - updated to new structure
export const mockMealPlan: ExtendedMealPlan = {
  Monday: {
    Breakfast: {
      id: 0,
      name: 'Test Meal 1',
      effort: 2,
      
      hasRedMeat: false,
      mealType: 'breakfast',
      url: '',
      ingredients: [
        { id: 0, mealId: 0, name: 'Ingredient 1', quantity: 2, unit: 'cups' },
      ],
      steps: [],
    },
    Lunch: null,
    Dinner: {
      id: 0,
      name: 'Test Meal 2',
      effort: 3,
      
      hasRedMeat: true,
      mealType: 'dinner',
      url: '',
      ingredients: [
        { id: 0, mealId: 0, name: 'Ingredient 2', quantity: 1, unit: 'tbsp' },
      ],
      steps: [],
    },
  },
  Tuesday: {
    Breakfast: null,
    Lunch: {
      id: 0,
      name: 'Test Lunch Meal',
      effort: 1,
      
      hasRedMeat: false,
      mealType: 'lunch',
      url: '',
      ingredients: [],
      steps: [],
    },
    Dinner: {
      id: 0,
      name: 'Test Dinner Meal',
      effort: 2,
      
      hasRedMeat: false,
      mealType: 'dinner',
      url: '',
      ingredients: [],
      steps: [],
    },
  },
  Wednesday: {
    Breakfast: null,
    Lunch: null,
    Dinner: null,
  },
  Thursday: {
    Breakfast: null,
    Lunch: null,
    Dinner: null,
  },
  Friday: {
    Breakfast: null,
    Lunch: null,
    Dinner: {
      id: 5,
      name: 'Eating out',
      effort: 1,
      
      hasRedMeat: false,
      mealType: 'dinner',
      url: '',
      ingredients: [],
      steps: [],
    },
  },
  Saturday: {
    Breakfast: null,
    Lunch: null,
    Dinner: null,
  },
  Sunday: {
    Breakfast: null,
    Lunch: null,
    Dinner: null,
  },
};

// Keep the old mockMealPlan for backward compatibility with tests that still expect the old format
export const mockMealPlanLegacy = {
  days: [
    {
      dayIndex: 0,
      mealType: 'dinner',
      meal: {
        id: 0,
        name: 'Test Meal 1',
        effort: 2,
        
        hasRedMeat: false,
        mealType: 'dinner',
        url: '',
        ingredients: [
          { id: 0, mealId: 0, name: 'Ingredient 1', quantity: 2, unit: 'cups' },
        ],
        steps: [],
      },
    },
    {
      dayIndex: 1,
      mealType: 'dinner',
      meal: {
        id: 0,
        name: 'Test Meal 2',
        effort: 3,
        
        hasRedMeat: true,
        mealType: 'dinner',
        url: '',
        ingredients: [
          { id: 0, mealId: 0, name: 'Ingredient 2', quantity: 1, unit: 'tbsp' },
        ],
        steps: [],
      },
    },
    {
      dayIndex: 4,
      mealType: 'dinner',
      meal: {
        id: 0,
        name: 'Eating out',
        effort: 1,
        
        hasRedMeat: false,
        mealType: 'dinner',
        url: '',
        ingredients: [],
        steps: [],
      },
    },
  ],
  shoppingList: [],
} as unknown as WeeklyMealPlan;

export const mockAvailableMeals: Meal[] = [
  {
    id: 0,
    url: '',
    steps: [],
    name: 'Available Test Meal',
    effort: 2,
    
    hasRedMeat: false,
    mealType: 'breakfast',
    ingredients: [],
  },
  {
    id: 0,
    url: '',
    steps: [],
    name: 'Another Available Meal',
    effort: 1,
    
    hasRedMeat: true,
    mealType: 'breakfast',
    ingredients: [],
  },
];

export const mockShoppingList: Ingredient[] = [
  { id: 0, mealId: 0, name: 'Ingredient 1', quantity: 2, unit: 'cups' },
  { id: 0, mealId: 0, name: 'Ingredient 2', quantity: 1, unit: 'tbsp' },
];

// Helper function to setup common fetch mocks
export const setupFetchMocks = (options?: {
  mealPlan?: ExtendedMealPlan;
  availableMeals?: Meal[];
  shoppingList?: Ingredient[];
  customMocks?: Record<string, any>;
}) => {
  const mocks = {
    mealPlan: options?.mealPlan || mockMealPlan,
    availableMeals: options?.availableMeals || mockAvailableMeals,
    shoppingList: options?.shoppingList || mockShoppingList,
    ...options?.customMocks,
  };

  global.fetch = jest.fn((url: RequestInfo) => {
    const urlStr = url.toString();

    if (
      urlStr.includes('/api/mealplan') &&
      !urlStr.includes('replace') &&
      !urlStr.includes('generate') &&
      !urlStr.includes('finalize')
    ) {
      // Always return the ExtendedMealPlan structure
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mocks.mealPlan),
      } as Response);
    }

    if (urlStr.includes('/api/mealplan/generate')) {
      // Return the ExtendedMealPlan structure for generate endpoint
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mocks.mealPlan),
      } as Response);
    }

    if (urlStr.includes('/api/meals') && !urlStr.includes('swap')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mocks.availableMeals),
      } as Response);
    }

    if (urlStr.includes('/api/shoppinglist')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mocks.shoppingList),
      } as Response);
    }

    if (urlStr.includes('/api/meals/swap')) {
      // Return a new meal for swap operations
      const newMeal = {
        id: 0,
        name: 'Swapped Test Meal',
        effort: 1,
        
        hasRedMeat: false,
        mealType: 'dinner',
        url: '',
        ingredients: [],
        steps: [],
      };
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(newMeal),
      } as Response);
    }

    if (urlStr.includes('/api/health') || urlStr.includes('/api/reconnect')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      } as Response);
    }

    // Default response for other endpoints
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);
  }) as jest.Mock;

  return global.fetch;
};

// Cleanup function to reset fetch mocks
export const cleanupFetchMocks = () => {
  jest.restoreAllMocks();
};

// Custom render function for components that need context providers
export function customRender(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
): RenderResult {
  return render(ui, { ...options });
}

// Re-export everything from testing-library
export * from '@testing-library/react';
