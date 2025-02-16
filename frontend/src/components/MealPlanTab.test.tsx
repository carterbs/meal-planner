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

describe("MealPlanTab", () => {
    const mockShowToast = jest.fn();

    beforeEach(() => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockMealPlan),
            })
        ) as jest.Mock;
        mockShowToast.mockClear();
    });

    test("loads and displays meal plan", async () => {
        // Mock fetch to return a delayed response
        global.fetch = jest.fn(() =>
            new Promise((resolve) => {
                setTimeout(() => {
                    resolve({
                        ok: true,
                        json: () => Promise.resolve(mockMealPlan),
                    });
                }, 100);
            })
        ) as jest.Mock;

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

    it('handles error when swapping meals', async () => {
        const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => { });
        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                json: () => Promise.resolve(mockMealPlan)
            }))
            .mockImplementationOnce(() => Promise.reject(new Error('Network error')));

        render(<MealPlanTab showToast={mockShowToast} />);

        // Wait for meal plan to load
        await waitFor(() => {
            expect(screen.queryByText('Loading meal plan...')).not.toBeInTheDocument();
        });

        // Try to swap a meal
        await userEvent.click(screen.getAllByText('Swap Meal')[0]);

        expect(mockConsoleError).toHaveBeenCalledWith('Error swapping meal:', expect.any(Error));
        mockConsoleError.mockRestore();
    });

    it('handles error when getting shopping list', async () => {
        const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => { });
        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                json: () => Promise.resolve(mockMealPlan)
            }))
            .mockImplementationOnce(() => Promise.reject(new Error('Network error')));

        render(<MealPlanTab showToast={mockShowToast} />);

        // Wait for meal plan to load
        await waitFor(() => {
            expect(screen.queryByText('Loading meal plan...')).not.toBeInTheDocument();
        });

        // Try to get shopping list
        await userEvent.click(screen.getByText('Get Shopping List'));

        expect(mockConsoleError).toHaveBeenCalled();
        mockConsoleError.mockRestore();
    });

    it('does not attempt to swap meal when no meal plan exists', async () => {
        global.fetch = jest.fn().mockImplementationOnce(() => Promise.resolve({
            json: () => Promise.resolve(null)
        }));

        render(<MealPlanTab showToast={mockShowToast} />);

        // Wait for loading state
        expect(screen.getByText('Loading meal plan...')).toBeInTheDocument();

        // Verify swap function doesn't cause errors when no meal plan exists
        const day = 'Monday';
        const result = await screen.queryByText('Swap Meal');
        expect(result).not.toBeInTheDocument();
    });

    test("handles null cases for meal plan functions", async () => {
        // Mock fetch to return null meal plan initially
        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(null),
            })) as jest.Mock;

        render(<MealPlanTab showToast={mockShowToast} />);

        // Test getShoppingList with null meal plan
        const shoppingListButton = screen.getByText("Get Shopping List");
        fireEvent.click(shoppingListButton);

        // Test swapMeal with null meal
        const swapButton = screen.queryByText("Swap Meal");
        if (swapButton) {
            fireEvent.click(swapButton);
        }
    });

    test("sorts meal plan days correctly", async () => {
        const unorderedMealPlan = {
            Sunday: mockMealPlan.Monday,
            Wednesday: mockMealPlan.Tuesday,
            Monday: mockMealPlan.Friday,
        };

        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve(unorderedMealPlan),
            })
        ) as jest.Mock;

        render(<MealPlanTab showToast={mockShowToast} />);

        await waitFor(() => {
            const rows = screen.getAllByRole("row");
            // First row is header, so we start from index 1
            expect(rows[1]).toHaveTextContent("Monday");
            expect(rows[2]).toHaveTextContent("Wednesday");
            expect(rows[3]).toHaveTextContent("Sunday");
        });
    });

    test("handles null meal plan when swapping", async () => {
        // Mock fetch to return null meal plan
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve(null),
            })
        ) as jest.Mock;

        render(<MealPlanTab showToast={mockShowToast} />);

        // Wait for loading state to appear
        expect(screen.getByText("Loading meal plan...")).toBeInTheDocument();

        // Try to swap a meal (this should be a no-op since there's no meal plan)
        // We can't actually click a swap button since it won't be rendered,
        // but we can verify that no fetch calls were made for swapping
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(1); // Only the initial meal plan fetch
        });
    });

    test("handles missing day in meal plan when swapping", async () => {
        // Create a meal plan with a missing day
        const partialMealPlan = {
            Monday: mockMealPlan.Monday,
            // Tuesday is missing
            Friday: mockMealPlan.Friday
        };

        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve(partialMealPlan),
            })
        ) as jest.Mock;

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

    test("does not show swap button for Friday or 'Eating out' meals", async () => {
        render(<MealPlanTab showToast={mockShowToast} />);

        await waitFor(() => {
            expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
        });

        // Get all cells containing "Friday"
        const fridayCells = screen.getAllByText("Friday");
        expect(fridayCells.length).toBeGreaterThan(0);

        // Find the Friday row and verify it has no swap button
        const fridayRow = fridayCells[0].closest('tr');
        expect(fridayRow).not.toBeNull();
        if (fridayRow) {
            expect(within(fridayRow).queryByText("Swap Meal")).not.toBeInTheDocument();
        }

        // Verify "Eating out" meal has no swap button
        const eatingOutCells = screen.getAllByText("Eating out");
        expect(eatingOutCells.length).toBeGreaterThan(0);
        const eatingOutRow = eatingOutCells[0].closest('tr');
        expect(eatingOutRow).not.toBeNull();
        if (eatingOutRow) {
            expect(within(eatingOutRow).queryByText("Swap Meal")).not.toBeInTheDocument();
        }
    });

    test("handles getting shopping list with no meal plan", async () => {
        // Mock fetch to return null meal plan
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve(null),
            })
        ) as jest.Mock;

        render(<MealPlanTab showToast={mockShowToast} />);

        // Wait for loading state to appear
        expect(screen.getByText("Loading meal plan...")).toBeInTheDocument();

        // Click get shopping list button
        fireEvent.click(screen.getByText("Get Shopping List"));

        // Verify that no additional fetch calls were made
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(1); // Only the initial meal plan fetch
        });

        // Verify no shopping list is shown
        expect(screen.queryByText("Shopping List")).not.toBeInTheDocument();
    });

    test("handles empty shopping list", async () => {
        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockMealPlan),
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

        // Verify no shopping list is shown (since it's empty)
        await waitFor(() => {
            expect(screen.queryByText("Shopping List")).not.toBeInTheDocument();
        });
    });

    test("handles finalize plan with no meal plan", async () => {
        // Mock fetch to return null for meal plan
        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                json: () => Promise.resolve(null)
            }))
            .mockImplementationOnce(() => Promise.resolve({
                text: () => Promise.resolve("Plan finalized")
            }));

        render(<MealPlanTab showToast={mockShowToast} />);

        // Click finalize button
        const finalizeButton = screen.getByText("Finalize Meal Plan");
        fireEvent.click(finalizeButton);

        // Verify that no finalize call was made since there's no meal plan
        await waitFor(() => {
            expect(mockShowToast).not.toHaveBeenCalled();
        });
    });

    test("handles finalize plan with meal plan", async () => {
        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                json: () => Promise.resolve(mockMealPlan)
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                text: () => Promise.resolve("Plan finalized")
            }));

        render(<MealPlanTab showToast={mockShowToast} />);

        // Wait for meal plan to load
        await waitFor(() => {
            expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
        });

        // Click finalize button
        const finalizeButton = screen.getByText("Finalize Meal Plan");
        fireEvent.click(finalizeButton);

        // Verify that the toast was shown
        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith("Plan finalized");
        });
    });

    test("handles swap meal with no meal for day", async () => {
        // Mock fetch to return a meal plan with a missing day
        const partialMealPlan = {
            Monday: mockMealPlan.Monday,
            // Tuesday is missing
            Friday: mockMealPlan.Friday
        };
        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                json: () => Promise.resolve(partialMealPlan)
            }));

        render(<MealPlanTab showToast={mockShowToast} />);

        // Wait for meal plan to load
        await waitFor(() => {
            expect(screen.getByText("Test Meal 1")).toBeInTheDocument();
        });

        // Verify that Monday has a swap button (since it has a meal)
        const mondayRow = screen.getByText("Monday").closest('tr');
        expect(mondayRow).not.toBeNull();
        if (mondayRow) {
            expect(within(mondayRow).getByText("Swap Meal")).toBeInTheDocument();
        }

        // Verify that Tuesday's row doesn't exist at all (since it has no meal)
        expect(screen.queryByText("Tuesday")).not.toBeInTheDocument();

        // Verify that Friday's row exists but has no swap button (since it's Friday)
        const fridayRow = screen.getByText("Friday").closest('tr');
        expect(fridayRow).not.toBeNull();
        if (fridayRow) {
            expect(within(fridayRow).queryByText("Swap Meal")).not.toBeInTheDocument();
        }
    });
}); 