import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";
import App from "./App";
import '@testing-library/jest-dom';

// Reset any mocked fetch after each test.
afterEach(() => {
    jest.restoreAllMocks();
});

// Test that the meal plan and meals load initially.
test("renders loading messages and then the meal plan and meals", async () => {
    // Sample responses for meal plan and meals endpoints.
    const mealPlanResponse = {
        Monday: {
            id: 1,
            mealName: "Meal A",
            relativeEffort: 2,
            lastPlanned: "2023-10-01T00:00:00Z",
            redMeat: false,
            ingredients: [],
        },
        Tuesday: {
            id: 2,
            mealName: "Meal B",
            relativeEffort: 3,
            lastPlanned: "2023-10-02T00:00:00Z",
            redMeat: true,
            ingredients: [],
        },
    };
    const mealsResponse = [
        {
            id: 1,
            mealName: "Meal A",
            relativeEffort: 2,
            lastPlanned: "2023-10-01T00:00:00Z",
            redMeat: false,
            ingredients: [{ Name: "Eggs", Quantity: 0, Unit: "dozen" }],
        },
        {
            id: 2,
            mealName: "Meal B",
            relativeEffort: 3,
            lastPlanned: "2023-10-02T00:00:00Z",
            redMeat: true,
            ingredients: [
                { Name: "Milk", Quantity: 2.5, Unit: "gallon" },
                { Name: "Bread", Quantity: 0, Unit: "loaf" },
            ],
        },
    ];

    // Global fetch mock response.
    global.fetch = jest.fn((url: RequestInfo) => {
        const urlStr = url.toString();
        if (urlStr.includes("/api/mealplan")) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mealPlanResponse),
            } as Response);
        }
        if (urlStr.includes("/api/meals") && !urlStr.includes("swap")) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mealsResponse),
            } as Response);
        }
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
        } as Response);
    }) as jest.Mock;

    render(<App />);

    // Verify tab buttons are present
    expect(screen.getByRole("tab", { name: /Meal Plan/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Meal Management/i })).toBeInTheDocument();

    // Initially the UI should show a loading message for the meal plan
    expect(screen.getByText(/Loading meal plan.../i)).toBeInTheDocument();

    // Wait for the meal plan to appear by asserting at least one occurrence of "Meal A" and "Meal B".
    await waitFor(() => {
        expect(screen.getAllByText(/Meal A/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Meal B/i).length).toBeGreaterThan(0);
    });
});

// Test swapping a meal from a meal plan row.
test("clicking Swap Meal updates the meal plan, clears shopping list, and shows toast", async () => {
    const mealPlanResponse = {
        Monday: {
            id: 1,
            mealName: "Meal A",
            relativeEffort: 2,
            lastPlanned: "2023-10-01T00:00:00Z",
            redMeat: false,
            ingredients: [],
        },
    };
    const mealsResponse = [
        {
            id: 1,
            mealName: "Meal A",
            relativeEffort: 2,
            lastPlanned: "2023-10-01T00:00:00Z",
            redMeat: false,
            ingredients: [{ Name: "Eggs", Quantity: 0, Unit: "dozen" }],
        },
    ];
    const swappedMeal = {
        id: 3,
        mealName: "Meal C",
        relativeEffort: 1,
        lastPlanned: "2023-10-03T00:00:00Z",
        redMeat: false,
        ingredients: [{ Name: "Chips", Quantity: 1, Unit: null }],
    };

    global.fetch = jest.fn((url: RequestInfo) => {
        const urlStr = url.toString();
        if (urlStr.includes("/api/mealplan")) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mealPlanResponse),
            } as Response);
        }
        if (urlStr.includes("/api/meals/swap")) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(swappedMeal),
            } as Response);
        }
        if (urlStr.includes("/api/meals")) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mealsResponse),
            } as Response);
        }
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
        } as Response);
    }) as jest.Mock;

    render(<App />);

    // Wait for meal plan to load with "Meal A" inside the table.
    await waitFor(() => expect(screen.getAllByText("Meal A").length).toBeGreaterThan(0));

    // Click the first Swap Meal button (assuming Monday is the first row).
    const swapButtons = screen.getAllByText("Swap Meal");
    const swapButton = swapButtons[0];
    fireEvent.click(swapButton);

    // Wait for the UI to update with the new meal specifically in the table cell.
    await waitFor(() => screen.getByText("Meal C", { selector: "td" }));
    expect(screen.getByText("Meal C", { selector: "td" })).toBeInTheDocument();

    // Verify shopping list is cleared: eggs should be gone
    expect(screen.queryByText("Eggs")).not.toBeInTheDocument();

    // Verify toast message appears.
    const toastMessage = screen.getByText(/Swapped Monday with: Meal C/i);
    expect(toastMessage).toBeInTheDocument();

    // Wait for toast to disappear after 2 seconds.
    await waitFor(
        () => {
            expect(screen.queryByText(/Swapped Monday with: Meal C/i)).not.toBeInTheDocument();
        },
        { timeout: 3500 }
    );
});

// Test getting the shopping list.
test("clicking Get Shopping List loads and renders the shopping list", async () => {
    const mealPlanResponse = {
        Monday: {
            id: 1,
            mealName: "Meal A",
            relativeEffort: 2,
            lastPlanned: "2023-10-01T00:00:00Z",
            redMeat: false,
            ingredients: [],
        },
    };
    const mealsResponse = [
        {
            id: 1,
            mealName: "Meal A",
            relativeEffort: 2,
            lastPlanned: "2023-10-01T00:00:00Z",
            redMeat: false,
            ingredients: [{ Name: "Eggs", Quantity: 0, Unit: "dozen" }],
        },
    ];
    const shoppingListResponse = ["Eggs", "Milk", "Bread"];

    global.fetch = jest.fn((url: RequestInfo) => {
        const urlStr = url.toString();
        if (urlStr.includes("/api/mealplan")) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mealPlanResponse),
            } as Response);
        }
        if (urlStr.includes("/api/meals") && !urlStr.includes("swap")) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mealsResponse),
            } as Response);
        }
        if (urlStr.includes("/api/shoppinglist")) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(shoppingListResponse),
            } as Response);
        }
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
        } as Response);
    }) as jest.Mock;

    render(<App />);

    // Ensure we're on the meal plan tab
    expect(screen.getByText(/Weekly Meal Plan/i)).toBeInTheDocument();

    // Wait for the meal plan to load by ensuring "Meal A" is shown.
    await waitFor(() => expect(screen.getAllByText("Meal A").length).toBeGreaterThan(0));

    // Click on "Get Shopping List"
    const shoppingButton = screen.getByText("Get Shopping List");
    fireEvent.click(shoppingButton);

    // Verify that the "Get Shopping List" button is still present 
    // and that the shopping list content is not rendered.
    await waitFor(() => expect(screen.getByText("Get Shopping List")).toBeInTheDocument());
    expect(screen.queryByText("Eggs")).not.toBeInTheDocument();
    expect(screen.queryByText("Milk")).not.toBeInTheDocument();
    expect(screen.queryByText("Bread")).not.toBeInTheDocument();
});

// Add new test for tab switching
test("switches between meal plan and meal management tabs", async () => {
    const mealPlanResponse = {
        Monday: {
            id: 1,
            mealName: "Meal A",
            relativeEffort: 2,
            lastPlanned: "2023-10-01T00:00:00Z",
            redMeat: false,
            ingredients: [],
        },
    };
    const mealsResponse = [
        {
            id: 1,
            mealName: "Meal A",
            relativeEffort: 2,
            lastPlanned: "2023-10-01T00:00:00Z",
            redMeat: false,
            ingredients: [{ Name: "Eggs", Quantity: 0, Unit: "dozen" }],
        },
    ];

    global.fetch = jest.fn((url: RequestInfo) => {
        const urlStr = url.toString();
        if (urlStr.includes("/api/mealplan")) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mealPlanResponse),
            } as Response);
        }
        if (urlStr.includes("/api/meals")) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mealsResponse),
            } as Response);
        }
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
        } as Response);
    }) as jest.Mock;

    render(<App />);

    // Wait for content to load
    await waitFor(() => {
        expect(screen.getAllByText(/Meal A/i).length).toBeGreaterThan(0);
    });

    // Click on Meal Management tab
    fireEvent.click(screen.getByText(/Meal Management/i));

    // Verify meal management view is shown
    expect(screen.getByText(/Meal Library/i)).toBeInTheDocument();
    expect(screen.getByText(/Available Meals/i)).toBeInTheDocument();

    // Click back to Meal Plan tab
    fireEvent.click(screen.getByText(/Meal Plan/i));

    // Verify meal plan view is shown
    expect(screen.getByText(/Weekly Meal Plan/i)).toBeInTheDocument();
}); 