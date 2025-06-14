import React from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { Meal, MealPlan, Ingredient, MealType } from './types';

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
            id: 1,
            mealName: "Test Meal 1",
            relativeEffort: 2,
            lastPlanned: "2024-02-15T00:00:00Z",
            redMeat: false,
            mealType: "breakfast" as MealType,
            ingredients: [
                { ID: 1, Name: "Ingredient 1", Quantity: 2, Unit: "cups" }
            ]
        },
        Lunch: null,
        Dinner: {
            id: 2,
            mealName: "Test Meal 2",
            relativeEffort: 3,
            lastPlanned: "2024-02-15T00:00:00Z",
            redMeat: true,
            mealType: "dinner" as MealType,
            ingredients: [
                { ID: 2, Name: "Ingredient 2", Quantity: 1, Unit: "tbsp" }
            ]
        }
    },
    Tuesday: {
        Breakfast: null,
        Lunch: {
            id: 3,
            mealName: "Test Lunch Meal",
            relativeEffort: 1,
            lastPlanned: "2024-02-15T00:00:00Z",
            redMeat: false,
            mealType: "lunch" as MealType,
            ingredients: []
        },
        Dinner: {
            id: 4,
            mealName: "Test Dinner Meal",
            relativeEffort: 2,
            lastPlanned: "2024-02-15T00:00:00Z",
            redMeat: false,
            mealType: "dinner" as MealType,
            ingredients: []
        }
    },
    Wednesday: {
        Breakfast: null,
        Lunch: null,
        Dinner: null
    },
    Thursday: {
        Breakfast: null,
        Lunch: null,
        Dinner: null
    },
    Friday: {
        Breakfast: null,
        Lunch: null,
        Dinner: {
            id: 5,
            mealName: "Eating out",
            relativeEffort: 1,
            lastPlanned: "2024-02-15T00:00:00Z",
            redMeat: false,
            mealType: "dinner" as MealType,
            ingredients: []
        }
    },
    Saturday: {
        Breakfast: null,
        Lunch: null,
        Dinner: null
    },
    Sunday: {
        Breakfast: null,
        Lunch: null,
        Dinner: null
    }
};

// Keep the old mockMealPlan for backward compatibility with tests that still expect the old format
export const mockMealPlanLegacy: MealPlan = {
    Monday: {
        id: 1,
        mealName: "Test Meal 1",
        relativeEffort: 2,
        lastPlanned: "2024-02-15T00:00:00Z",
        redMeat: false,
        mealType: "dinner",
        ingredients: [
            { ID: 1, Name: "Ingredient 1", Quantity: 2, Unit: "cups" }
        ]
    },
    Tuesday: {
        id: 2,
        mealName: "Test Meal 2",
        relativeEffort: 3,
        lastPlanned: "2024-02-15T00:00:00Z",
        redMeat: true,
        mealType: "dinner",
        ingredients: [
            { ID: 2, Name: "Ingredient 2", Quantity: 1, Unit: "tbsp" }
        ]
    },
    Friday: {
        id: 3,
        mealName: "Eating out",
        relativeEffort: 1,
        lastPlanned: "2024-02-15T00:00:00Z",
        redMeat: false,
        mealType: "dinner",
        ingredients: []
    }
};

export const mockAvailableMeals: Meal[] = [
    {
        id: 6,
        mealName: "Available Test Meal",
        relativeEffort: 2,
        lastPlanned: "2024-02-15T00:00:00Z",
        redMeat: false,
        mealType: "breakfast",
        ingredients: []
    },
    {
        id: 7,
        mealName: "Another Available Meal",
        relativeEffort: 1,
        lastPlanned: "2024-02-15T00:00:00Z",
        redMeat: true,
        mealType: "breakfast",
        ingredients: []
    }
];

export const mockShoppingList: Ingredient[] = [
    { ID: 1, Name: "Ingredient 1", Quantity: 2, Unit: "cups" },
    { ID: 2, Name: "Ingredient 2", Quantity: 1, Unit: "tbsp" }
];

// Helper function to setup common fetch mocks
export const setupFetchMocks = (options?: {
    mealPlan?: ExtendedMealPlan,
    availableMeals?: Meal[],
    shoppingList?: Ingredient[],
    customMocks?: Record<string, any>
}) => {
    const mocks = {
        mealPlan: options?.mealPlan || mockMealPlan,
        availableMeals: options?.availableMeals || mockAvailableMeals,
        shoppingList: options?.shoppingList || mockShoppingList,
        ...options?.customMocks
    };

    global.fetch = jest.fn((url: RequestInfo) => {
        const urlStr = url.toString();

        if (urlStr.includes("/api/mealplan") && !urlStr.includes("replace") && !urlStr.includes("generate") && !urlStr.includes("finalize")) {
            // Always return the ExtendedMealPlan structure
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mocks.mealPlan),
            } as Response);
        }

        if (urlStr.includes("/api/mealplan/generate")) {
            // Return the ExtendedMealPlan structure for generate endpoint
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mocks.mealPlan),
            } as Response);
        }

        if (urlStr.includes("/api/meals") && !urlStr.includes("swap")) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mocks.availableMeals),
            } as Response);
        }

        if (urlStr.includes("/api/shoppinglist")) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mocks.shoppingList),
            } as Response);
        }

        if (urlStr.includes("/api/meals/swap")) {
            // Return a new meal for swap operations
            const newMeal = {
                id: 999,
                mealName: "Swapped Test Meal",
                relativeEffort: 1,
                lastPlanned: "2024-02-15T00:00:00Z",
                redMeat: false,
                mealType: "dinner",
                ingredients: []
            };
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(newMeal),
            } as Response);
        }

        if (urlStr.includes("/api/health") || urlStr.includes("/api/reconnect")) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ status: "ok" }),
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
    options?: Omit<RenderOptions, 'wrapper'>
): RenderResult {
    return render(ui, { ...options });
}

// Re-export everything from testing-library
export * from '@testing-library/react'; 