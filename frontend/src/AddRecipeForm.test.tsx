import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddRecipeForm from './AddRecipeForm';

beforeEach(() => {
  // Reset fetch mocks before each test
  global.fetch = jest.fn();
});

describe('AddRecipeForm', () => {
  const mockOnRecipeAdded = jest.fn();

  test('renders the form with all fields', () => {
    render(<AddRecipeForm onRecipeAdded={mockOnRecipeAdded} />);
    
    // Check form heading
    expect(screen.getByText('Add New Recipe')).toBeInTheDocument();
    
    // Check input fields
    expect(screen.getByLabelText('Recipe Name')).toBeInTheDocument();
    expect(screen.getByText('Effort Level')).toBeInTheDocument();
    expect(screen.getByLabelText('Contains Red Meat')).toBeInTheDocument();
    expect(screen.getByLabelText('Paste Ingredients (one per line)')).toBeInTheDocument();
    
    // Check buttons
    expect(screen.getByText('Process Ingredients')).toBeInTheDocument();
    expect(screen.getByText('Add Recipe')).toBeInTheDocument();
  });

  test('processes ingredients from raw text', () => {
    render(<AddRecipeForm onRecipeAdded={mockOnRecipeAdded} />);
    
    const rawIngredientsField = screen.getByLabelText('Paste Ingredients (one per line)');
    
    // Enter some raw ingredients
    fireEvent.change(rawIngredientsField, { 
      target: { value: '2 cups flour\n1 tsp salt\npepper to taste' } 
    });
    
    // Click the process button
    fireEvent.click(screen.getByText('Process Ingredients'));
    
    // Check that ingredients were processed
    expect(screen.getByText('2 cups flour')).toBeInTheDocument();
    expect(screen.getByText('1 tsp salt')).toBeInTheDocument();
    expect(screen.getByText('pepper to taste')).toBeInTheDocument();
  });

  test('submits the form with valid data', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 1,
        mealName: 'Test Recipe',
        relativeEffort: 3,
        redMeat: false,
        ingredients: [
          { ID: 1, Name: 'Test Ingredient', Quantity: 1, Unit: 'cup', MealID: 1 }
        ]
      })
    });

    render(<AddRecipeForm onRecipeAdded={mockOnRecipeAdded} />);
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText('Recipe Name'), { 
      target: { value: 'Test Recipe' } 
    });
    
    const rawIngredientsField = screen.getByLabelText('Paste Ingredients (one per line)');
    fireEvent.change(rawIngredientsField, { 
      target: { value: '1 cup Test Ingredient' } 
    });
    
    // Process ingredients
    fireEvent.click(screen.getByText('Process Ingredients'));
    
    // Submit the form
    fireEvent.click(screen.getByText('Add Recipe'));
    
    // Wait for the submission to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/meals',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      
      expect(mockOnRecipeAdded).toHaveBeenCalledTimes(1);
    });
  });

  test('shows error when form submission fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Failed to create recipe'));

    render(<AddRecipeForm onRecipeAdded={mockOnRecipeAdded} />);
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText('Recipe Name'), { 
      target: { value: 'Test Recipe' } 
    });
    
    const rawIngredientsField = screen.getByLabelText('Paste Ingredients (one per line)');
    fireEvent.change(rawIngredientsField, { 
      target: { value: '1 cup Test Ingredient' } 
    });
    
    // Process ingredients
    fireEvent.click(screen.getByText('Process Ingredients'));
    
    // Submit the form
    fireEvent.click(screen.getByText('Add Recipe'));
    
    // Wait for the error message
    await waitFor(() => {
      expect(screen.getByText('Error creating recipe')).toBeInTheDocument();
      expect(mockOnRecipeAdded).not.toHaveBeenCalled();
    });
  });
});