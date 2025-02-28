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
        mockShowToast.mockClear();
    });

    const renderWithMocks = async (
        mocks = {
            mealPlan: mockMealPlan,
            availableMeals: mockAvailableMeals,
            shoppingList: mockShoppingList
        }
    ) => {
        // Setup fetch mocks
        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mocks.mealPlan),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mocks.availableMeals),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mocks.shoppingList),
            })) as jest.Mock;

        // Render component
        const result = render(<MealPlanTab showToast={mockShowToast} />);

        // Wait for loading state to complete
        await waitFor(() => {
            expect(screen.queryByText("Loading meal plan...")).not.toBeInTheDocument();
        });

        // Wait a tick for state updates to complete
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        return result;
    };

    test("loads and displays meal plan", async () => {
        await renderWithMocks();

        // Verify meal details are shown
        expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
        expect(screen.getByText("Test Meal 2")).toBeInTheDocument();
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

        // Wait for loading state to complete
        await waitFor(() => {
            expect(screen.queryByText("Loading meal plan...")).not.toBeInTheDocument();
        });

        // Find and click the swap button for Monday
        const swapButtons = screen.getAllByText("Swap Meal");
        fireEvent.click(swapButtons[0]);

        // Verify the toast message
        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining("New Test Meal"));
        });
    });

    test("loads available meals for selection", async () => {
        await renderWithMocks();

        // Verify meal details are shown
        expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
        expect(screen.getByText("Test Meal 2")).toBeInTheDocument();

        // Open the select menu
        const user = userEvent.setup();
        await user.click(screen.getByTestId("meal-select-Monday"));

        // Wait for menu items to appear, including hidden ones
        const options = await screen.findAllByRole('option', { hidden: true });
        expect(options.length).toBeGreaterThan(0);

        // Verify available meals are in the menu
        expect(options[0]).toHaveTextContent("Available Meal 1");
        expect(options[1]).toHaveTextContent("Available Meal 2");
    });

    test("handles error when selecting a meal", async () => {
        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockMealPlan),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockAvailableMeals),
            }))
            .mockImplementationOnce(() => Promise.reject(new Error("Failed to replace"))) as jest.Mock;

        render(<MealPlanTab showToast={mockShowToast} />);

        // Wait for loading state to complete
        await waitFor(() => {
            expect(screen.queryByText("Loading meal plan...")).not.toBeInTheDocument();
        });

        // Open the select menu
        const userError = userEvent.setup();
        await userError.click(screen.getByTestId("meal-select-Monday"));

        // Wait for menu items to appear, including hidden ones
        const optionsError = await screen.findAllByRole('option', { hidden: true });
        const option = optionsError.find(opt => opt.textContent === "Available Meal 1");
        expect(option).toBeDefined();
        if (option) { fireEvent.click(option); }

        // Verify error toast was shown
        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith("Error replacing meal");
        });
    });

    test("gets shopping list", async () => {
        // Setup fetch mocks with shopping list endpoint
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

        // Wait for loading state to complete
        await waitFor(() => {
            expect(screen.queryByText("Loading meal plan...")).not.toBeInTheDocument();
        });

        // Click get shopping list button and wait for response
        await act(async () => {
            fireEvent.click(screen.getByText("Get Shopping List"));
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        // Wait for shopping list to be displayed
        await waitFor(() => {
            expect(screen.getByText("2 cups Ingredient 1")).toBeInTheDocument();
            expect(screen.getByText("1 tbsp Ingredient 2")).toBeInTheDocument();
        });
    });

    test("copies shopping list to clipboard", async () => {
        // Mock clipboard API
        const mockClipboard = {
            writeText: jest.fn().mockResolvedValue(undefined)
        };
        Object.defineProperty(navigator, 'clipboard', {
            value: mockClipboard,
            writable: true
        });

        // Setup fetch mocks with shopping list endpoint
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

        // Wait for loading state to complete
        await waitFor(() => {
            expect(screen.queryByText("Loading meal plan...")).not.toBeInTheDocument();
        });

        // Get shopping list and wait for it to be displayed
        await act(async () => {
            fireEvent.click(screen.getByText("Get Shopping List"));
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        await waitFor(() => {
            expect(screen.getByText("2 cups Ingredient 1")).toBeInTheDocument();
        });

        // Click copy to clipboard button and wait for operation to complete
        await act(async () => {
            fireEvent.click(screen.getByText("Copy to Clipboard"));
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        // Verify clipboard was called with correct text
        expect(mockClipboard.writeText).toHaveBeenCalledWith(
            "2 cups Ingredient 1\n1 tbsp Ingredient 2"
        );
        expect(mockShowToast).toHaveBeenCalledWith("Shopping list copied to clipboard!");
    });

    test("handles clipboard error gracefully", async () => {
        // Mock clipboard API to throw error
        const mockClipboard = {
            writeText: jest.fn().mockRejectedValue(new Error("Clipboard error"))
        };
        Object.defineProperty(navigator, 'clipboard', {
            value: mockClipboard,
            writable: true
        });

        // Setup fetch mocks with shopping list endpoint
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

        // Wait for loading state to complete
        await waitFor(() => {
            expect(screen.queryByText("Loading meal plan...")).not.toBeInTheDocument();
        });

        // Get shopping list and wait for it to be displayed
        await act(async () => {
            fireEvent.click(screen.getByText("Get Shopping List"));
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        await waitFor(() => {
            expect(screen.getByText("2 cups Ingredient 1")).toBeInTheDocument();
        });

        // Click copy to clipboard button and wait for error
        await act(async () => {
            fireEvent.click(screen.getByText("Copy to Clipboard"));
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        // Verify error toast was shown
        expect(mockShowToast).toHaveBeenCalledWith("Failed to copy to clipboard");
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

        // Wait for loading state to complete
        await waitFor(() => {
            expect(screen.queryByText("Loading meal plan...")).not.toBeInTheDocument();
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

        await act(async () => {
            render(<MealPlanTab showToast={mockShowToast} />);
        });

        await waitFor(() => {
            expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
        });

        // Click get shopping list button to show the meal plan summary
        await act(async () => {
            fireEvent.click(screen.getByText("Get Shopping List"));
        });

        // Verify meal plan summary is shown
        await waitFor(() => {
            expect(screen.getByText("Meal Plan Summary")).toBeInTheDocument();
            // Instead of looking for formatted strings like "Monday: Test Meal 1",
            // look for the individual cell values in the table
            expect(screen.getAllByText("Monday")[0]).toBeInTheDocument();
            expect(screen.getAllByText("Test Meal 1")[0]).toBeInTheDocument();
            expect(screen.getAllByText("Tuesday")[0]).toBeInTheDocument();
            expect(screen.getAllByText("Test Meal 2")[0]).toBeInTheDocument();
            expect(screen.getAllByText("Friday")[0]).toBeInTheDocument();
            expect(screen.getAllByText("Eating out")[0]).toBeInTheDocument();
        });

        // Click copy meal plan button
        await act(async () => {
            fireEvent.click(screen.getByTestId("copy-meal-plan"));
            // Wait for the clipboard operation to complete
            return mockClipboard.writeText.mock.results[0].value;
        });

        // Verify clipboard was called with formatted table text
        // The exact format doesn't matter as long as it contains the key data
        expect(mockClipboard.writeText).toHaveBeenCalled();
        const clipboardText = mockClipboard.writeText.mock.calls[0][0];
        expect(clipboardText).toContain("Day");
        expect(clipboardText).toContain("Meal");
        expect(clipboardText).toContain("Effort");
        expect(clipboardText).toContain("URL");
        expect(clipboardText).toContain("Monday");
        expect(clipboardText).toContain("Test Meal 1");
        expect(clipboardText).toContain("Tuesday");
        expect(clipboardText).toContain("Test Meal 2");
        expect(clipboardText).toContain("Friday");
        expect(clipboardText).toContain("Eating out");
        expect(mockShowToast).toHaveBeenCalledWith(expect.stringMatching(/^Meal plan copied to clipboard.*$/));
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

        await act(async () => {
            render(<MealPlanTab showToast={mockShowToast} />);
        });

        await waitFor(() => {
            expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
        });

        // Click get shopping list button to show the meal plan summary
        await act(async () => {
            fireEvent.click(screen.getByText("Get Shopping List"));
        });

        // Wait for meal plan summary to appear
        await waitFor(() => {
            expect(screen.getByText("Meal Plan Summary")).toBeInTheDocument();
        });

        // Click copy meal plan button and wait for error
        await act(async () => {
            fireEvent.click(screen.getByTestId("copy-meal-plan"));
            try {
                await mockClipboard.writeText.mock.results[0].value;
            } catch (e) {
                // Expected error
            }
        });

        // Verify error was logged and toast was shown
        await waitFor(() => {
            expect(consoleError).toHaveBeenCalledWith("Failed to copy to clipboard:", expect.any(Error));
            expect(mockShowToast).toHaveBeenCalledWith("Failed to copy to clipboard");
        });

        consoleError.mockRestore();
    });
}); 