import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MealAutocomplete } from './MealAutocomplete';
import { Meal } from '../types';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockMeals: Meal[] = [
    {
        id: 1,
        mealName: "Chicken Stir Fry",
        relativeEffort: 3,
        lastPlanned: "2024-01-01T00:00:00Z",
        redMeat: false,
        url: "https://example.com/recipe1",
        mealType: "dinner",
        ingredients: []
    },
    {
        id: 2,
        mealName: "Beef Tacos",
        relativeEffort: 4,
        lastPlanned: "2024-01-02T00:00:00Z",
        redMeat: true,
        url: "",
        mealType: "dinner",
        ingredients: []
    },
    {
        id: 3,
        mealName: "Scrambled Eggs",
        relativeEffort: 1,
        lastPlanned: "2024-01-03T00:00:00Z",
        redMeat: false,
        url: "",
        mealType: "breakfast",
        ingredients: []
    }
];

describe('MealAutocomplete', () => {
    const mockOnChange = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockMeals.filter(meal => meal.mealType === 'dinner'))
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('renders with placeholder text', async () => {
        render(
            <MealAutocomplete
                value={null}
                onChange={mockOnChange}
                mealType="dinner"
                placeholder="Select a meal..."
            />
        );

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Select a meal...')).toBeInTheDocument();
        });
    });

    it('fetches meals on mount', async () => {
        render(
            <MealAutocomplete
                value={null}
                onChange={mockOnChange}
                mealType="dinner"
            />
        );

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith('/api/meals?type=dinner');
        });
    });

    it('displays selected meal value', async () => {
        const selectedMeal = mockMeals[0];

        render(
            <MealAutocomplete
                value={selectedMeal}
                onChange={mockOnChange}
                mealType="dinner"
            />
        );

        await waitFor(() => {
            expect(screen.getByDisplayValue('Chicken Stir Fry')).toBeInTheDocument();
        });
    });

    it('calls onChange when a meal is selected', async () => {
        const user = userEvent.setup();

        render(
            <MealAutocomplete
                value={null}
                onChange={mockOnChange}
                mealType="dinner"
            />
        );

        // Wait for meals to load
        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalled();
        });

        // Click on the autocomplete input
        const input = screen.getByRole('combobox');
        await user.click(input);

        // Wait for options to appear and click on one
        await waitFor(() => {
            expect(screen.getByText('Chicken Stir Fry')).toBeInTheDocument();
        });

        await user.click(screen.getByText('Chicken Stir Fry'));

        expect(mockOnChange).toHaveBeenCalledWith(mockMeals[0]);
    });

    it('filters options based on input', async () => {
        const user = userEvent.setup();

        render(
            <MealAutocomplete
                value={null}
                onChange={mockOnChange}
                mealType="dinner"
            />
        );

        // Wait for meals to load
        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalled();
        });

        const input = screen.getByRole('combobox');
        await user.click(input);
        await user.type(input, 'chicken');

        await waitFor(() => {
            expect(screen.getByText('Chicken Stir Fry')).toBeInTheDocument();
            expect(screen.queryByText('Beef Tacos')).not.toBeInTheDocument();
        });
    });

    it('shows loading indicator while fetching meals', () => {
        // Mock a pending fetch
        mockFetch.mockReturnValue(new Promise(() => { }));

        render(
            <MealAutocomplete
                value={null}
                onChange={mockOnChange}
                mealType="dinner"
            />
        );

        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('displays meal details in options', async () => {
        const user = userEvent.setup();

        render(
            <MealAutocomplete
                value={null}
                onChange={mockOnChange}
                mealType="dinner"
            />
        );

        // Wait for meals to load
        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalled();
        });

        const input = screen.getByRole('combobox');
        await user.click(input);

        await waitFor(() => {
            expect(screen.getByText('Effort: 3')).toBeInTheDocument();
            expect(screen.getByText('Effort: 4')).toBeInTheDocument();
            expect(screen.getByText('Red Meat')).toBeInTheDocument();
            expect(screen.getByText('Has Recipe')).toBeInTheDocument();
        });
    });

    it('can be disabled', async () => {
        render(
            <MealAutocomplete
                value={null}
                onChange={mockOnChange}
                mealType="dinner"
                disabled={true}
            />
        );

        const input = screen.getByRole('combobox');
        expect(input).toBeDisabled();
    });

    it('handles fetch errors gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        mockFetch.mockRejectedValue(new Error('Network error'));

        render(
            <MealAutocomplete
                value={null}
                onChange={mockOnChange}
                mealType="dinner"
            />
        );

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith('Error fetching meals:', expect.any(Error));
        });

        consoleSpy.mockRestore();
    });

    it('handles non-ok response gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        mockFetch.mockResolvedValue({
            ok: false,
            status: 500
        });

        render(
            <MealAutocomplete
                value={null}
                onChange={mockOnChange}
                mealType="dinner"
            />
        );

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch meals');
        });

        consoleSpy.mockRestore();
    });
}); 