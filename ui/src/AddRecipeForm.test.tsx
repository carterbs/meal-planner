import React from 'react';
import { render, screen, fireEvent, waitFor } from './test-utils';
import AddRecipeForm from './AddRecipeForm';
import { setupFetchMocks, cleanupFetchMocks } from './test-utils';
import '@testing-library/jest-dom';

// Mock the gateway functions
jest.mock('@mealplanner/generated/dist/gateway/index.js', () => ({
  postMeals: jest.fn(),
}));

// Mock the client creation
jest.mock('@mealplanner/generated/dist/gateway/client/index.js', () => ({
  createClient: jest.fn(() => ({})),
  createConfig: jest.fn(() => ({})),
}));

import { postMeals } from '@mealplanner/generated/dist/gateway/index.js';

beforeEach(() => {
  setupFetchMocks();
});

afterEach(() => {
  cleanupFetchMocks();
});

describe('AddRecipeForm', () => {
  const mockOnRecipeAdded = jest.fn();
  const mockPostMeals = postMeals as jest.MockedFunction<typeof postMeals>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders the Add New Recipe form', () => {
    render(<AddRecipeForm onRecipeAdded={mockOnRecipeAdded} />);
    expect(screen.getByText('Add New Recipe')).toBeInTheDocument();
    expect(screen.getByText('Double Quantities')).toBeInTheDocument();
  });

  test('doubles ingredient quantities in the text area', () => {
    render(<AddRecipeForm onRecipeAdded={mockOnRecipeAdded} />);

    // Find the textarea by its placeholder text pattern
    const rawIngredientsField =
      screen.getByPlaceholderText(/flour.*sugar.*salt/);

    // Enter some raw ingredients with mixed formats
    fireEvent.change(rawIngredientsField, {
      target: { value: '1 cup milk\n¼ tsp salt\n2.5 tbsp butter' },
    });

    // Click the double quantities button
    fireEvent.click(screen.getByText('Double Quantities'));

    // Check that quantities were doubled in the raw ingredients
    expect(rawIngredientsField).toHaveValue(
      '2 cup milk\n0.5 tsp salt\n5 tbsp butter',
    );
  });

  test('processes and converts fraction characters', () => {
    render(<AddRecipeForm onRecipeAdded={mockOnRecipeAdded} />);

    const rawIngredientsField =
      screen.getByPlaceholderText(/flour.*sugar.*salt/);

    // Enter ingredients with Unicode fraction characters
    fireEvent.change(rawIngredientsField, {
      target: { value: '¾ cup sugar' },
    });

    // Click the process button
    fireEvent.click(screen.getByText('Process Ingredients'));

    // The ingredient should be processed and displayed in the chip list
    const chips = screen.getAllByRole('button');
    expect(chips.length).toBeGreaterThan(0);
  });

  test('handles adding a recipe', async () => {
    // Mock the gateway API call
    mockPostMeals.mockResolvedValueOnce({
      data: {
        id: 1,
        name: 'New Recipe',
        effort: 3,
        hasRedMeat: false,
        url: '',
        mealType: 'dinner',
        ingredients: [],
        steps: [],
      },
      error: null,
    } as any);

    render(<AddRecipeForm onRecipeAdded={mockOnRecipeAdded} />);

    // Fill in recipe name
    const nameInput = screen.getByLabelText(/Recipe Name/i);
    fireEvent.change(nameInput, { target: { value: 'New Recipe' } });

    // Fill in raw ingredients and process them
    const rawIngredientsField =
      screen.getByPlaceholderText(/flour.*sugar.*salt/);
    fireEvent.change(rawIngredientsField, {
      target: { value: '1 cup flour\n2 tbsp sugar' },
    });
    fireEvent.click(screen.getByText('Process Ingredients'));

    // Wait for ingredients to be processed and verify they appear
    await waitFor(() => {
      expect(screen.getByText('Processed Ingredients:')).toBeInTheDocument();
    });

    // Submit the form
    fireEvent.click(screen.getByText('Add Recipe'));

    // Verify the API was called correctly
    await waitFor(() => {
      expect(mockPostMeals).toHaveBeenCalledWith({
        client: {},
        body: {
          meal: expect.objectContaining({
            name: 'New Recipe',
            effort: 3,
            hasRedMeat: false,
            url: '',
            mealType: 'dinner',
            ingredients: expect.arrayContaining([
              expect.objectContaining({
                name: 'flour',
                quantity: 1,
                unit: 'cup',
              }),
              expect.objectContaining({
                name: 'sugar',
                quantity: 2,
                unit: 'tbsp',
              }),
            ]),
            steps: [],
          }),
        },
      });
    });

    // Verify the callback was called
    await waitFor(() => {
      expect(mockOnRecipeAdded).toHaveBeenCalled();
    });
  });
});
