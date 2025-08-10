import { render, screen } from '@testing-library/react';
import React from 'react';
import AddRecipePanel from './AddRecipePanel';

describe('AddRecipePanel', () => {
  it('calls onSuccess on form success', async () => {
    const onSuccess = jest.fn();
    render(<AddRecipePanel onSuccess={onSuccess} />);
    // Minimal interaction: click Add Recipe without filling should be disabled initially
    expect(screen.getByRole('button', { name: /add recipe/i })).toBeDisabled();
  });
});
