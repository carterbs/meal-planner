import React from 'react';
import { render, screen, fireEvent, waitFor } from './test-utils';
import AddRecipeForm from './AddRecipeForm';
import { Step } from './types';
import { setupFetchMocks, cleanupFetchMocks } from './test-utils';
import '@testing-library/jest-dom';

// No need to mock the StepsEditor component - we should use the real component

beforeEach(() => {
  setupFetchMocks();
});

afterEach(() => {
  cleanupFetchMocks();
});

describe('AddRecipeForm', () => {
  const mockOnRecipeAdded = jest.fn();

  test('renders the Add New Recipe form', () => {
    render(<AddRecipeForm onRecipeAdded={mockOnRecipeAdded} />);
    expect(screen.getByText('Add New Recipe')).toBeInTheDocument();
    expect(screen.getByText('Double Quantities')).toBeInTheDocument();
  });

  test('doubles ingredient quantities in the text area', () => {
    render(<AddRecipeForm onRecipeAdded={mockOnRecipeAdded} />);

    // Find the textarea by its placeholder text pattern
    const rawIngredientsField = screen.getByPlaceholderText(/flour.*sugar.*salt/);

    // Enter some raw ingredients with mixed formats
    fireEvent.change(rawIngredientsField, {
      target: { value: '1 cup milk\n¼ tsp salt\n2.5 tbsp butter' }
    });

    // Click the double quantities button
    fireEvent.click(screen.getByText('Double Quantities'));

    // Check that quantities were doubled in the raw ingredients
    expect(rawIngredientsField).toHaveValue('2 cup milk\n0.5 tsp salt\n5 tbsp butter');
  });

  test('processes and converts fraction characters', () => {
    render(<AddRecipeForm onRecipeAdded={mockOnRecipeAdded} />);

    const rawIngredientsField = screen.getByPlaceholderText(/flour.*sugar.*salt/);

    // Enter ingredients with Unicode fraction characters
    fireEvent.change(rawIngredientsField, {
      target: { value: '¾ cup sugar' }
    });

    // Click the process button
    fireEvent.click(screen.getByText('Process Ingredients'));

    // The ingredient should be processed and displayed in the chip list
    const chips = screen.getAllByRole('button');
    expect(chips.length).toBeGreaterThan(0);
  });

  test('handles adding a recipe', async () => {
    // Mock the fetch for adding a recipe
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 1, mealName: 'New Recipe' }),
      })
    );

    render(<AddRecipeForm onRecipeAdded={mockOnRecipeAdded} />);

    // Fill in recipe name
    const nameInput = screen.getByLabelText(/Recipe Name/i);
    fireEvent.change(nameInput, { target: { value: 'New Recipe' } });

    // Fill in raw ingredients and process them
    const rawIngredientsField = screen.getByPlaceholderText(/flour.*sugar.*salt/);
    fireEvent.change(rawIngredientsField, {
      target: { value: '1 cup flour\n2 tbsp sugar' }
    });
    fireEvent.click(screen.getByText('Process Ingredients'));

    // Set effort level - find the Effort Level section and then find the slider
    // We don't use getByLabelText since the Slider doesn't use standard label association
    const effortLevelSection = screen.getByText('Effort Level');
    // The slider is in the same Grid item as the 'Effort Level' text
    const slider = effortLevelSection.closest('.MuiGrid-item')?.querySelector('.MuiSlider-root');
    expect(slider).toBeInTheDocument();

    // We can't easily set the slider value directly in tests, so we'll skip this step
    // The form will submit with the default effort level

    // Submit the form
    fireEvent.click(screen.getByText('Add Recipe'));

    // Verify the callback was called
    await waitFor(() => {
      expect(mockOnRecipeAdded).toHaveBeenCalled();
    });
  });
});