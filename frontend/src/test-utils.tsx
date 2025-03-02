import React from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { Meal, MealPlan, Ingredient } from './types';

// Shared mock data for tests
export const mockMealPlan: MealPlan = {
    Monday: {
        id: 1,
        mealName: "Test Meal 1",
        relativeEffort: 2,
        lastPlanned: "2024-02-15T00:00:00Z",
        redMeat: false,
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
        ingredients: []
    }
};

export const mockAvailableMeals: Meal[] = [
    {
        id: 4,
        mealName: "Available Meal 1",
        relativeEffort: 2,
        lastPlanned: "2024-02-15T00:00:00Z",
        redMeat: false,
        ingredients: []
    },
    {
        id: 5,
        mealName: "Available Meal 2",
        relativeEffort: 1,
        lastPlanned: "2024-02-15T00:00:00Z",
        redMeat: true,
        ingredients: []
    }
];

export const mockShoppingList: Ingredient[] = [
    { ID: 1, Name: "Ingredient 1", Quantity: 2, Unit: "cups" },
    { ID: 2, Name: "Ingredient 2", Quantity: 1, Unit: "tbsp" }
];

// Helper function to setup common fetch mocks
export const setupFetchMocks = (options?: {
    mealPlan?: MealPlan,
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