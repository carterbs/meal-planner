import React from "react";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { MealPlanTab } from "./MealPlanTab";
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

const mockMealPlan = {
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

const mockShoppingList = [
    { ID: 1, Name: "Ingredient 1", Quantity: 2, Unit: "cups" },
    { ID: 2, Name: "Ingredient 2", Quantity: 1, Unit: "tbsp" }
];

const mockAvailableMeals = [
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

describe("MealPlanTab", () => {
    const mockShowToast = jest.fn();

    beforeEach(() => {
        // Mock both initial fetch calls - one for meal plan and one for available meals
        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockMealPlan),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockAvailableMeals),
            })) as jest.Mock;
        mockShowToast.mockClear();
    });

    test("loads and displays meal plan", async () => {
        // Mock fetch to return a delayed response for both calls
        global.fetch = jest.fn()
            .mockImplementationOnce(() => new Promise((resolve) => {
                setTimeout(() => {
                    resolve({
                        ok: true,
                        json: () => Promise.resolve(mockMealPlan),
                    });
                }, 100);
            }))
            .mockImplementationOnce(() => new Promise((resolve) => {
                setTimeout(() => {
                    resolve({
                        ok: true,
                        json: () => Promise.resolve(mockAvailableMeals),
                    });
                }, 100);
            })) as jest.Mock;

        render(<MealPlanTab showToast={mockShowToast} />);

        // Check loading state
        expect(screen.getByText("Loading meal plan...")).toBeInTheDocument();

        // Wait for meal plan to load
        await waitFor(() => {
            expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
            expect(screen.getByText("Test Meal 2")).toBeInTheDocument();
        });

        // Verify meal details are shown
        expect(screen.getByText("2")).toBeInTheDocument(); // Effort level
        expect(screen.getByText("3")).toBeInTheDocument(); // Effort level
    });

    test("swaps a meal successfully", async () => {
        const newMeal = {
            id: 4,
            mealName: "New Test Meal",
            relativeEffort: 1,
            lastPlanned: "2024-02-15T00:00:00Z",
            redMeat: false,
            ingredients: []
        };

        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockMealPlan),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockAvailableMeals),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(newMeal),
            })) as jest.Mock;

        render(<MealPlanTab showToast={mockShowToast} />);

        await waitFor(() => {
            expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
        });

        // Find and click the swap button for Monday
        const swapButtons = screen.getAllByText("Swap Meal");
        fireEvent.click(swapButtons[0]);

        // Verify the toast message
        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining("New Test Meal"));
        });
    });

    test("gets shopping list", async () => {
        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockMealPlan),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockAvailableMeals),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockShoppingList),
            })) as jest.Mock;

        render(<MealPlanTab showToast={mockShowToast} />);

        await waitFor(() => {
            expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
        });

        // Click get shopping list button
        fireEvent.click(screen.getByText("Get Shopping List"));

        // Verify shopping list items appear
        await waitFor(() => {
            expect(screen.getByText("2 cups Ingredient 1")).toBeInTheDocument();
            expect(screen.getByText("1 tbsp Ingredient 2")).toBeInTheDocument();
        });
    });

    test("finalizes meal plan", async () => {
        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockMealPlan),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockAvailableMeals),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                text: () => Promise.resolve("Plan finalized"),
            })) as jest.Mock;

        render(<MealPlanTab showToast={mockShowToast} />);

        await waitFor(() => {
            expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
        });

        // Click finalize button
        fireEvent.click(screen.getByText("Finalize Meal Plan"));

        // Verify toast was shown
        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith("Plan finalized");
        });
    });

    test("handles error when fetching meal plan", async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => { });

        global.fetch = jest.fn(() =>
            Promise.reject(new Error("Failed to fetch"))
        ) as jest.Mock;

        render(<MealPlanTab showToast={mockShowToast} />);

        await waitFor(() => {
            expect(consoleError).toHaveBeenCalled();
        });

        consoleError.mockRestore();
    });

    test("handles error when swapping meal", async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => { });

        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockMealPlan),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockAvailableMeals),
            }))
            .mockImplementationOnce(() => Promise.reject(new Error("Failed to swap"))) as jest.Mock;

        render(<MealPlanTab showToast={mockShowToast} />);

        await waitFor(() => {
            expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
        });

        const swapButtons = screen.getAllByText("Swap Meal");
        fireEvent.click(swapButtons[0]);

        await waitFor(() => {
            expect(consoleError).toHaveBeenCalled();
        });

        consoleError.mockRestore();
    });

    test("handles error when getting shopping list", async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => { });

        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockMealPlan),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockAvailableMeals),
            }))
            .mockImplementationOnce(() => Promise.reject(new Error("Failed to get shopping list"))) as jest.Mock;

        render(<MealPlanTab showToast={mockShowToast} />);

        await waitFor(() => {
            expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
        });

        // Click get shopping list button
        fireEvent.click(screen.getByText("Get Shopping List"));

        await waitFor(() => {
            expect(consoleError).toHaveBeenCalled();
        });

        consoleError.mockRestore();
    });

    test("handles error when finalizing meal plan", async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => { });

        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockMealPlan),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockAvailableMeals),
            }))
            .mockImplementationOnce(() => Promise.reject(new Error("Failed to finalize"))) as jest.Mock;

        render(<MealPlanTab showToast={mockShowToast} />);

        await waitFor(() => {
            expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
        });

        // Click finalize button
        fireEvent.click(screen.getByText("Finalize Meal Plan"));

        await waitFor(() => {
            expect(consoleError).toHaveBeenCalledWith("Error finalizing plan:", expect.any(Error));
        });

        consoleError.mockRestore();
    });

    test("handles null meal plan when swapping", async () => {
        // Mock fetch to return null meal plan
        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(null),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockAvailableMeals),
            })) as jest.Mock;

        render(<MealPlanTab showToast={mockShowToast} />);

        // Wait for loading state to appear
        expect(screen.getByText("Loading meal plan...")).toBeInTheDocument();

        // Verify that no swap buttons are rendered
        expect(screen.queryByText("Swap Meal")).not.toBeInTheDocument();
    });

    test("handles missing day in meal plan when swapping", async () => {
        // Create a meal plan with a missing day
        const partialMealPlan = {
            Monday: mockMealPlan.Monday,
            // Tuesday is missing
            Friday: mockMealPlan.Friday
        };

        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(partialMealPlan),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockAvailableMeals),
            })) as jest.Mock;

        render(<MealPlanTab showToast={mockShowToast} />);

        await waitFor(() => {
            expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
        });

        // Verify that Tuesday is not in the plan
        expect(screen.queryByText("Test Meal 2")).not.toBeInTheDocument();

        // Verify that no swap button is rendered for Tuesday
        const swapButtons = screen.getAllByText("Swap Meal");
        expect(swapButtons).toHaveLength(1); // Only Monday should have a swap button (Friday is "Eating out")
    });

    test("loads available meals for selection", async () => {
        render(<MealPlanTab showToast={mockShowToast} />);

        // Wait for initial data to load
        await waitFor(() => {
            expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
        });

        // Find and click the select
        const select = within(screen.getByTestId("meal-select-Monday")).getByRole("combobox");
        await userEvent.click(select);

        // Wait for menu items to be available
        await waitFor(() => {
            const options = screen.getAllByRole("option");
            expect(options.length).toBeGreaterThan(0);
            expect(options[0]).toHaveTextContent("Available Meal 1");
        });
    });

    test("selects a meal for a specific day", async () => {
        const selectedMeal = mockAvailableMeals[0];
        console.log('Mock Available Meals:', mockAvailableMeals);

        // Mock fetch to return initial data and then the successful meal selection response
        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => {
                    console.log('First fetch response (meal plan):', mockMealPlan);
                    return Promise.resolve(mockMealPlan);
                }
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => {
                    console.log('Second fetch response (available meals):', mockAvailableMeals);
                    return Promise.resolve(mockAvailableMeals);
                }
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(selectedMeal)
            }));

        render(<MealPlanTab showToast={mockShowToast} />);

        // Wait for initial data to load
        await waitFor(() => {
            expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
        });

        // Find and click the select
        const select = within(screen.getByTestId("meal-select-Monday")).getByRole("combobox");
        await userEvent.click(select);

        // Log available options after clicking select
        const options = screen.getAllByRole("option");
        console.log('Available options:', options.map(opt => opt.textContent));

        // Find and click an option
        const option = await screen.findByRole("option", { name: selectedMeal.mealName });
        await userEvent.click(option);

        // Wait for the API call to complete and state to update
        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith("/api/mealplan/replace", expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    day: "Monday",
                    new_meal_id: selectedMeal.id
                })
            }));
        });

        // Wait for the toast message and verify it shows the correct meal name
        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith(`Updated Monday's meal to: ${selectedMeal.mealName}`);
        });
    });

    test("handles error when selecting a meal", async () => {
        // Mock fetch to return an error
        (fetch as jest.Mock).mockImplementationOnce(() => Promise.reject("API Error"));

        // Spy on console.error
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => { });

        render(<MealPlanTab showToast={mockShowToast} />);

        // Wait for initial data to load
        await waitFor(() => {
            expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
        });

        // Find and click the select
        const select = within(screen.getByTestId("meal-select-Monday")).getByRole("combobox");
        await userEvent.click(select);

        // Find and click an option
        const option = await screen.findByRole("option", { name: "Available Meal 1" });
        await userEvent.click(option);

        // Verify error handling
        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith("Error replacing meal");
            expect(consoleError).toHaveBeenCalled();
        });

        // Clean up
        consoleError.mockRestore();
    });

    test("handles getting shopping list with no meal plan", async () => {
        // Mock fetch to return null meal plan
        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(null),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockAvailableMeals),
            })) as jest.Mock;

        render(<MealPlanTab showToast={mockShowToast} />);

        // Wait for loading state to appear
        expect(screen.getByText("Loading meal plan...")).toBeInTheDocument();

        // Click get shopping list button
        fireEvent.click(screen.getByText("Get Shopping List"));

        // Verify that no additional fetch calls were made
        expect(global.fetch).toHaveBeenCalledTimes(2); // Only the initial meal plan and available meals fetches
    });

    test("handles empty shopping list", async () => {
        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockMealPlan),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockAvailableMeals),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve([]), // Empty shopping list
            })) as jest.Mock;

        render(<MealPlanTab showToast={mockShowToast} />);

        await waitFor(() => {
            expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
        });

        // Click get shopping list button
        fireEvent.click(screen.getByText("Get Shopping List"));

        // Verify no shopping list is shown
        await waitFor(() => {
            expect(screen.queryByText("Shopping List")).not.toBeInTheDocument();
        });
    });

    test("handles finalize plan with no meal plan", async () => {
        // Mock fetch to return null for meal plan
        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(null),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockAvailableMeals),
            })) as jest.Mock;

        render(<MealPlanTab showToast={mockShowToast} />);

        // Click finalize button
        fireEvent.click(screen.getByText("Finalize Meal Plan"));

        // Verify that no finalize call was made since there's no meal plan
        expect(global.fetch).toHaveBeenCalledTimes(2); // Only the initial meal plan and available meals fetches
    });

    test("handles finalize plan with meal plan", async () => {
        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockMealPlan),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockAvailableMeals),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                text: () => Promise.resolve("Plan finalized"),
            })) as jest.Mock;

        render(<MealPlanTab showToast={mockShowToast} />);

        await waitFor(() => {
            expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
        });

        // Click finalize button
        fireEvent.click(screen.getByText("Finalize Meal Plan"));

        // Verify that the toast was shown
        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith("Plan finalized");
        });
    });

    test("copies shopping list to clipboard", async () => {
        // Mock clipboard API
        const mockClipboard = {
            writeText: jest.fn().mockResolvedValue(undefined)
        };
        Object.assign(navigator, {
            clipboard: mockClipboard
        });

        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockMealPlan),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockAvailableMeals),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockShoppingList),
            })) as jest.Mock;

        render(<MealPlanTab showToast={mockShowToast} />);

        await waitFor(() => {
            expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
        });

        // Click get shopping list button
        fireEvent.click(screen.getByText("Get Shopping List"));

        // Wait for shopping list to appear
        await waitFor(() => {
            expect(screen.getByText("2 cups Ingredient 1")).toBeInTheDocument();
        });

        // Click copy to clipboard button
        fireEvent.click(screen.getByTestId("copy-shopping-list"));

        // Verify clipboard was called with formatted list
        const expectedClipboardText = "2 cups Ingredient 1\n1 tbsp Ingredient 2";
        expect(mockClipboard.writeText).toHaveBeenCalledWith(expectedClipboardText);

        // Verify toast was shown
        expect(mockShowToast).toHaveBeenCalledWith("Shopping list copied to clipboard!");
    });

    test("handles clipboard error gracefully", async () => {
        // Mock clipboard API with error
        const mockClipboard = {
            writeText: jest.fn().mockRejectedValue(new Error("Clipboard error"))
        };
        Object.assign(navigator, {
            clipboard: mockClipboard
        });

        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => { });

        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockMealPlan),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockAvailableMeals),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockShoppingList),
            })) as jest.Mock;

        render(<MealPlanTab showToast={mockShowToast} />);

        await waitFor(() => {
            expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
        });

        // Click get shopping list button
        fireEvent.click(screen.getByText("Get Shopping List"));

        // Wait for shopping list to appear
        await waitFor(() => {
            expect(screen.getByText("2 cups Ingredient 1")).toBeInTheDocument();
        });

        // Click copy to clipboard button
        fireEvent.click(screen.getByTestId("copy-shopping-list"));

        // Verify error was logged
        expect(consoleError).toHaveBeenCalledWith("Failed to copy to clipboard:", expect.any(Error));

        // Verify error toast was shown
        expect(mockShowToast).toHaveBeenCalledWith("Failed to copy to clipboard");

        consoleError.mockRestore();
    });

    test("shows and copies meal plan summary when shopping list is visible", async () => {
        // Mock clipboard API
        const mockClipboard = {
            writeText: jest.fn().mockResolvedValue(undefined)
        };
        Object.assign(navigator, {
            clipboard: mockClipboard
        });

        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockMealPlan),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockAvailableMeals),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockShoppingList),
            })) as jest.Mock;

        render(<MealPlanTab showToast={mockShowToast} />);

        await waitFor(() => {
            expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
        });

        // Click get shopping list button to show the meal plan summary
        fireEvent.click(screen.getByText("Get Shopping List"));

        // Verify meal plan summary is shown
        await waitFor(() => {
            expect(screen.getByText("Meal Plan Summary")).toBeInTheDocument();
            expect(screen.getByText("Monday: Test Meal 1")).toBeInTheDocument();
            expect(screen.getByText("Tuesday: Test Meal 2")).toBeInTheDocument();
            expect(screen.getByText("Friday: Eating out")).toBeInTheDocument();
        });

        // Click copy meal plan button
        fireEvent.click(screen.getByTestId("copy-meal-plan"));

        // Verify clipboard was called with formatted plan
        const expectedClipboardText = "Monday: Test Meal 1\nTuesday: Test Meal 2\nFriday: Eating out";
        expect(mockClipboard.writeText).toHaveBeenCalledWith(expectedClipboardText);

        // Verify toast was shown
        expect(mockShowToast).toHaveBeenCalledWith("Meal plan copied to clipboard!");
    });

    test("handles meal plan copy error gracefully", async () => {
        // Mock clipboard API with error
        const mockClipboard = {
            writeText: jest.fn().mockRejectedValue(new Error("Clipboard error"))
        };
        Object.assign(navigator, {
            clipboard: mockClipboard
        });

        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => { });

        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockMealPlan),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockAvailableMeals),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockShoppingList),
            })) as jest.Mock;

        render(<MealPlanTab showToast={mockShowToast} />);

        await waitFor(() => {
            expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
        });

        // Click get shopping list button to show the meal plan summary
        fireEvent.click(screen.getByText("Get Shopping List"));

        // Wait for meal plan summary to appear
        await waitFor(() => {
            expect(screen.getByText("Meal Plan Summary")).toBeInTheDocument();
        });

        // Click copy meal plan button
        fireEvent.click(screen.getByTestId("copy-meal-plan"));

        // Verify error was logged
        expect(consoleError).toHaveBeenCalledWith("Failed to copy to clipboard:", expect.any(Error));

        // Verify error toast was shown
        expect(mockShowToast).toHaveBeenCalledWith("Failed to copy to clipboard");

        consoleError.mockRestore();
    });
}); 