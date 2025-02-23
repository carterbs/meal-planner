import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MealManagementTab } from "./MealManagementTab";
import '@testing-library/jest-dom';
import userEvent from "@testing-library/user-event";

// Mock the DataGrid component with a simple implementation
jest.mock('@mui/x-data-grid', () => ({
    DataGrid: ({ rows, onRowClick }: any) => (
        <div>
            {rows.map((row: any) => (
                <button
                    key={row.id}
                    onClick={() => onRowClick({ id: row.id })}
                >
                    {row.mealName}
                </button>
            ))}
        </div>
    )
}));

const mockMeals = [
    {
        id: 1,
        mealName: "Test Meal",
        relativeEffort: 2,
        lastPlanned: "2024-01-01",
        redMeat: false,
        ingredients: [
            {
                ID: 1,
                Name: "Test Ingredient",
                Quantity: 1,
                Unit: "cup"
            }
        ]
    }
];

describe("MealManagementTab", () => {
    const mockShowToast = jest.fn();

    beforeEach(() => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockMeals),
            })
        ) as jest.Mock;
        mockShowToast.mockClear();
    });

    test("loads and displays meal details when selected", async () => {
        await act(async () => {
            render(<MealManagementTab showToast={mockShowToast} />);
        });

        // Wait for meals to load
        await waitFor(() => {
            expect(screen.getByText("Test Meal")).toBeInTheDocument();
        });

        // Click on the meal to show details
        await act(async () => {
            fireEvent.click(screen.getByText("Test Meal"));
        });

        // Verify meal details are shown
        expect(screen.getByText("Effort Level: 2")).toBeInTheDocument();
        expect(screen.getByText("Contains Red Meat: No")).toBeInTheDocument();
        expect(screen.getByText("1 cup Test Ingredient")).toBeInTheDocument();
    });

    test("edits an ingredient", async () => {
        const updatedMeal = {
            ...mockMeals[0],
            ingredients: [{
                ID: 1,
                Name: "Updated Ingredient",
                Quantity: 3,
                Unit: "tablespoons"
            }]
        };

        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockMeals),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(updatedMeal),
            })) as jest.Mock;

        await act(async () => {
            render(<MealManagementTab showToast={mockShowToast} />);
        });

        // Wait for meal to load and select it
        await waitFor(() => {
            expect(screen.getByText("Test Meal")).toBeInTheDocument();
        });
        await act(async () => {
            fireEvent.click(screen.getByText("Test Meal"));
        });

        // Click edit button
        await act(async () => {
            const editButton = screen.getByRole('button', { name: 'Edit' });
            fireEvent.click(editButton);
        });

        // Update ingredient fields
        const nameInput = screen.getByLabelText("Name");
        const quantityInput = screen.getByLabelText("Quantity");
        const unitInput = screen.getByLabelText("Unit");

        await act(async () => {
            fireEvent.change(nameInput, { target: { value: "Updated Ingredient" } });
            fireEvent.change(quantityInput, { target: { value: "3" } });
            fireEvent.change(unitInput, { target: { value: "tablespoons" } });
        });

        // Save changes
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        });

        // Verify toast was shown
        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith("Ingredient updated successfully");
        });
    });

    test("deletes an ingredient", async () => {
        const updatedMeal = {
            ...mockMeals[0],
            ingredients: []
        };

        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockMeals),
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(updatedMeal),
            })) as jest.Mock;

        await act(async () => {
            render(<MealManagementTab showToast={mockShowToast} />);
        });

        // Wait for meal to load and select it
        await waitFor(() => {
            expect(screen.getByText("Test Meal")).toBeInTheDocument();
        });
        await act(async () => {
            fireEvent.click(screen.getByText("Test Meal"));
        });

        // Click delete button
        await act(async () => {
            const deleteButton = screen.getByRole('button', { name: 'Delete' });
            fireEvent.click(deleteButton);
        });

        // Verify toast was shown and ingredient was removed
        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith("Ingredient deleted successfully");
            expect(screen.queryByText("1 cup Test Ingredient")).not.toBeInTheDocument();
        });
    });

    test("handles error when updating ingredient", async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => { });

        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockMeals),
            }))
            .mockImplementationOnce(() => Promise.reject(new Error("Failed to update"))) as jest.Mock;

        await act(async () => {
            render(<MealManagementTab showToast={mockShowToast} />);
        });

        await waitFor(() => {
            expect(screen.getByText("Test Meal")).toBeInTheDocument();
        });
        await act(async () => {
            fireEvent.click(screen.getByText("Test Meal"));
        });

        // Click edit button
        await act(async () => {
            const editButton = screen.getByRole('button', { name: 'Edit' });
            fireEvent.click(editButton);
        });

        // Try to save
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        });

        await waitFor(() => {
            expect(consoleError).toHaveBeenCalledWith("Error updating ingredient", expect.any(Error));
        });

        consoleError.mockRestore();
    });

    test("handles error when fetching meals", async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => { });

        global.fetch = jest.fn(() =>
            Promise.reject(new Error("Failed to fetch"))
        ) as jest.Mock;

        await act(async () => {
            render(<MealManagementTab showToast={mockShowToast} />);
        });

        await waitFor(() => {
            expect(consoleError).toHaveBeenCalledWith("Error fetching meals:", expect.any(Error));
        });

        consoleError.mockRestore();
    });

    test("handles invalid ingredient edits", async () => {
        await act(async () => {
            render(<MealManagementTab showToast={mockShowToast} />);
        });

        await waitFor(() => {
            expect(screen.getByText("Test Meal")).toBeInTheDocument();
        });
        await act(async () => {
            fireEvent.click(screen.getByText("Test Meal"));
        });

        // Click edit button
        await act(async () => {
            const editButton = screen.getByRole('button', { name: 'Edit' });
            fireEvent.click(editButton);
        });

        // Try to edit with invalid values
        const quantityInput = screen.getByLabelText("Quantity");
        await act(async () => {
            fireEvent.change(quantityInput, { target: { value: "invalid" } });
        });

        // The value should be null for invalid input
        expect(quantityInput).toHaveValue(null);

        // Empty string should also result in null
        await act(async () => {
            fireEvent.change(quantityInput, { target: { value: "" } });
        });
        expect(quantityInput).toHaveValue(null);

        // Valid number should be accepted
        await act(async () => {
            fireEvent.change(quantityInput, { target: { value: "42" } });
        });
        expect(quantityInput).toHaveValue(42);
    });

    test("deletes a meal", async () => {
        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockMeals)
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true
            })) as jest.Mock;

        render(<MealManagementTab showToast={mockShowToast} />);

        // Wait for meals to load and select one
        await waitFor(() => {
            expect(screen.getByText("Test Meal")).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText("Test Meal"));

        // Find and click delete button
        const deleteButton = screen.getByTestId("delete-meal-button");
        fireEvent.click(deleteButton);

        // Verify the meal was removed and toast was shown
        await waitFor(() => {
            expect(screen.queryByText("Test Meal")).not.toBeInTheDocument();
            expect(mockShowToast).toHaveBeenCalledWith("Meal deleted successfully");
        });
    });

    test("handles error when deleting meal", async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => { });

        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockMeals)
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: false
            })) as jest.Mock;

        render(<MealManagementTab showToast={mockShowToast} />);

        // Wait for meals to load and select one
        await waitFor(() => {
            expect(screen.getByText("Test Meal")).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText("Test Meal"));

        // Find and click delete button
        const deleteButton = screen.getByTestId("delete-meal-button");
        fireEvent.click(deleteButton);

        // Verify error was handled
        await waitFor(() => {
            expect(consoleError).toHaveBeenCalled();
            expect(mockShowToast).toHaveBeenCalledWith("Error deleting meal");
        });

        consoleError.mockRestore();
    });
}); 