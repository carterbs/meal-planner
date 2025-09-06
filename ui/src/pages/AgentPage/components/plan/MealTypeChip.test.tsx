import React from 'react';
import { render, screen } from '@testing-library/react';
import MealTypeChip from './MealTypeChip';

describe('MealTypeChip', () => {
  it('renders capitalized meal type', () => {
    render(<MealTypeChip mealType="breakfast" />);
    expect(screen.getByText('Breakfast')).toBeInTheDocument();
  });
});
