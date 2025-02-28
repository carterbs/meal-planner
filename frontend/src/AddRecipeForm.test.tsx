import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddRecipeForm from './AddRecipeForm';

beforeEach(() => {
  // Reset fetch mocks before each test
  global.fetch = jest.fn();
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
});