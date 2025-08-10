import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import FilterBar, { MealTypeFilter } from './FilterBar';

describe('FilterBar', () => {
  it('debounces text changes and triggers type changes immediately', async () => {
    const onTextChange = jest.fn();
    const onTypeChange = jest.fn();
    render(
      <FilterBar
        text=""
        type={'All'}
        onTextChange={onTextChange}
        onTypeChange={onTypeChange}
        debounceMs={50}
      />,
    );

    const input = screen.getByTestId('filterbar-search');
    await userEvent.type(input, 'abc');

    // ensure debounce fires
    await new Promise((r) => setTimeout(r, 80));
    expect(onTextChange).toHaveBeenLastCalledWith('abc');

    // click a type
    await userEvent.click(screen.getByRole('button', { name: 'Breakfast' }));
    expect(onTypeChange).toHaveBeenLastCalledWith(
      'Breakfast' as MealTypeFilter,
    );
  });
});
