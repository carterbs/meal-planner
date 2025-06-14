import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "./App";
import { mockMealPlan, mockAvailableMeals, mockShoppingList } from "./test-utils";

// Helper to setup mocks for all the API endpoints needed by App
const setupMocks = () => {
    // Mock the clipboard API for tests
    Object.assign(navigator, {
        clipboard: {
            writeText: jest.fn(() => Promise.resolve()),
        },
    });

    global.fetch = jest.fn((url) => {
        if (url === '/api/mealplan') {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    Monday: {
                        Breakfast: {
                            id: 1,
                            mealName: "Test Meal 1",
                            relativeEffort: 2,
                            lastPlanned: "2024-02-15T00:00:00Z",
                            redMeat: false,
                            mealType: "breakfast",
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
                            mealType: "dinner",
                            ingredients: [
                                { ID: 2, Name: "Ingredient 2", Quantity: 1, Unit: "tbsp" }
                            ]
                        }
                    },
                    Tuesday: {
                        Breakfast: null,
                        Lunch: null,
                        Dinner: null
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
                        Dinner: null
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
                })
            } as Response);
        }

        if (url.toString().includes('/api/meals')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve([
                    { id: 3, mealName: 'Available Meal 1', relativeEffort: 2, mealType: 'breakfast' },
                    { id: 4, mealName: 'Available Meal 2', relativeEffort: 1, mealType: 'breakfast' }
                ])
            } as Response);
        }

        if (url === '/api/shoppinglist') {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve([
                    { ID: 1, Name: "Ingredient 1", Quantity: 2, Unit: "cups" },
                    { ID: 2, Name: "Ingredient 2", Quantity: 1, Unit: "tbsp" }
                ])
            } as Response);
        }

        if (url === '/api/health') {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ status: "ok" })
            } as Response);
        }

        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({})
        } as Response);
    }) as jest.Mock;

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

        // Verify meal data appears after API calls resolve (now in autocomplete inputs)
        await waitFor(() => {
            expect(screen.getByDisplayValue(/Test Meal 1/i)).toBeInTheDocument();
        });

        expect(screen.getByDisplayValue(/Test Meal 2/i)).toBeInTheDocument();
    });

    test("allows changing meals through autocomplete", async () => {
        // Setup mock for meals endpoint to return available meals
        (global.fetch as jest.Mock).mockImplementation((url, options) => {
            if (url.toString().includes("/api/meals?type=")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve([
                        { id: 999, mealName: "New Test Meal", relativeEffort: 1, mealType: "breakfast" }
                    ])
                });
            }
            return setupMocks()(url, options);
        });

        render(<App />);

        // Wait for meal plan to load
        await waitFor(() => {
            expect(screen.getByDisplayValue(/Test Meal 1/i)).toBeInTheDocument();
        });

        // Find autocomplete inputs (should be multiple for different meal slots)
        const autocompleteInputs = screen.getAllByRole("combobox");
        expect(autocompleteInputs.length).toBeGreaterThan(0);

        // Click on the first autocomplete to open it
        fireEvent.click(autocompleteInputs[0]);

        // Verify that meals can be loaded for autocomplete
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining("/api/meals?type="),
            expect.any(Object)
        );
    });

    test("shows ingredients automatically within meal cards", async () => {
        render(<App />);

        // Wait for meal plan to load
        await waitFor(() => {
            expect(screen.getByDisplayValue(/Test Meal 1/i)).toBeInTheDocument();
        });

        // Verify ingredients are displayed within meal cards automatically
        await waitFor(() => {
            expect(screen.getByText(/Ingredient 1/i)).toBeInTheDocument();
            expect(screen.getByText(/Ingredient 2/i)).toBeInTheDocument();
        });

        // Verify the Copy Shopping List button exists
        expect(screen.getByText(/Copy Shopping List/i)).toBeInTheDocument();
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