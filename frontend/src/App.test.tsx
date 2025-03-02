import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "./App";
import { mockMealPlan, mockAvailableMeals, mockShoppingList } from "./test-utils";

// Helper to setup mocks for all the API endpoints needed by App
const setupMocks = () => {
    // Create a Jest mock for fetch
    global.fetch = jest.fn();

    // Default implementation for successful requests
    (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.toString().includes("/api/mealplan")) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockMealPlan)
            });
        }

        if (url.toString().includes("/api/meals")) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockAvailableMeals)
            });
        }

        if (url.toString().includes("/api/shoppinglist")) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockShoppingList)
            });
        }

        if (url.toString().includes("/api/health")) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ status: "ok" })
            });
        }

        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({})
        });
    });

    return global.fetch;
};

describe("App", () => {
    beforeEach(() => {
        setupMocks();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("renders and displays the meal plan data", async () => {
        render(<App />);

        // Verify initial loading state
        expect(screen.getByText(/Weekly Meal Plan/i)).toBeInTheDocument();

        // Verify meal data appears after API calls resolve
        await waitFor(() => {
            expect(screen.getByText(/Test Meal 1/i)).toBeInTheDocument();
        });

        expect(screen.getByText(/Test Meal 2/i)).toBeInTheDocument();
    });

    test("allows swapping meals", async () => {
        // Setup mock for swap endpoint with a specific response
        const swappedMeal = {
            id: 999,
            mealName: "Swapped Test Meal",
            relativeEffort: 1,
            lastPlanned: "2023-01-01",
            redMeat: false,
            ingredients: []
        };

        (global.fetch as jest.Mock).mockImplementation((url, options) => {
            if (url.toString().includes("/api/meals/swap")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(swappedMeal)
                });
            }
            return setupMocks()(url, options);
        });

        render(<App />);

        // Wait for meal plan to load
        await waitFor(() => {
            expect(screen.getByText(/Test Meal 1/i)).toBeInTheDocument();
        });

        // Find any Swap Meal button (without relying on table rows)
        const swapButton = screen.getAllByText(/Swap Meal/i)[0];
        expect(swapButton).toBeInTheDocument();
        fireEvent.click(swapButton);

        // Verify the API call was made
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining("/api/meals/swap"),
            expect.any(Object)
        );
    });

    test("shows shopping list when requested", async () => {
        render(<App />);

        // Wait for meal plan to load
        await waitFor(() => {
            expect(screen.getByText(/Test Meal 1/i)).toBeInTheDocument();
        });

        // Find and click the Get Shopping List button
        const shoppingListButton = screen.getByText(/Get Shopping List/i);
        fireEvent.click(shoppingListButton);

        // Verify shopping list items appear
        await waitFor(() => {
            expect(screen.getByText(/Ingredient 1/i)).toBeInTheDocument();
            expect(screen.getByText(/Ingredient 2/i)).toBeInTheDocument();
        });
    });

    test("can navigate between tabs", async () => {
        render(<App />);

        // Initially on Meal Plan tab
        await waitFor(() => {
            expect(screen.getByText(/Weekly Meal Plan/i)).toBeInTheDocument();
        });

        // Switch to Meal Management tab - get all tabs and click the second one
        const tabs = screen.getAllByRole("tab");
        expect(tabs.length).toBeGreaterThan(1);
        const mealManagementTab = tabs.find(tab => tab.textContent?.includes("Meal Management"));
        expect(mealManagementTab).toBeTruthy();
        if (mealManagementTab) {
            fireEvent.click(mealManagementTab);
        }

        // Verify Meal Management content appears
        await waitFor(() => {
            // Look for the "Browse Meals" and "Add New Recipe" text which will be present in the UI
            const browseOption = screen.getByText(/Browse Meals/i);
            expect(browseOption).toBeInTheDocument();

            const addOption = screen.getAllByText(/Add New Recipe/i)[0];
            expect(addOption).toBeInTheDocument();
        });

        // Switch back to Meal Plan tab - get all tabs and click the first one
        const tabsAgain = screen.getAllByRole("tab");
        const mealPlanTab = tabsAgain.find(tab => tab.textContent?.includes("Meal Plan"));
        expect(mealPlanTab).toBeTruthy();
        if (mealPlanTab) {
            fireEvent.click(mealPlanTab);
        }

        // Verify back on Meal Plan tab
        await waitFor(() => {
            expect(screen.getByText(/Weekly Meal Plan/i)).toBeInTheDocument();
        });
    });

    test("displays error when database connection fails", async () => {
        // Mock process.env.NODE_ENV to temporarily force using the fetch call instead of 
        // bypassing it in test environment
        const originalNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        // Mock fetch to simulate a database connection error
        (global.fetch as jest.Mock).mockImplementation(() => {
            return Promise.reject(new Error('Connection failed'));
        });

        render(<App />);

        // Wait for the error component to appear
        await waitFor(() => {
            expect(screen.getByText(/Database Connection Error/i)).toBeInTheDocument();
        });

        // Verify the retry button is present
        const retryButton = screen.getByText(/Retry Connection/i);
        expect(retryButton).toBeInTheDocument();

        // Now set up the mock for a successful retry
        // When reconnecting, we need to ensure all API endpoints return valid data
        (global.fetch as jest.Mock).mockImplementation((url) => {
            if (url === '/api/reconnect' || url === '/api/health') {
                return Promise.resolve({
                    json: () => Promise.resolve({ status: 'ok' })
                } as Response);
            } else if (url === '/api/mealplan') {
                return Promise.resolve({
                    json: () => Promise.resolve({ Monday: { id: 1, mealName: 'Test Meal 1', relativeEffort: 'Easy' } })
                } as Response);
            } else if (url === '/api/meals') {
                return Promise.resolve({
                    json: () => Promise.resolve([
                        { id: 2, mealName: 'Test Meal 2', relativeEffort: 'Medium' },
                        { id: 3, mealName: 'Test Meal 3', relativeEffort: 'Hard' }
                    ])
                } as Response);
            } else if (url === '/api/shoppinglist') {
                return Promise.resolve({
                    json: () => Promise.resolve([{ name: 'Test Ingredient', amount: '1 cup' }])
                } as Response);
            }
            return Promise.resolve({
                json: () => Promise.resolve({})
            } as Response);
        });

        // Click the retry button
        fireEvent.click(retryButton);

        // Wait for the success toast to appear
        await waitFor(() => {
            expect(screen.getByText(/Successfully reconnected/i)).toBeInTheDocument();
        });

        // Restore original NODE_ENV
        process.env.NODE_ENV = originalNodeEnv;
    });
}); 