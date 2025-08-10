import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import LibraryPanel from './LibraryPanel';
import { Meal } from '@mealplanner/generated';
import { useState } from 'react';

function meal(id: number, name: string): Meal {
  return new Meal({
    id,
    name,
    effort: 2,
    hasRedMeat: false,
    url: '',
    mealType: 'dinner',
    ingredients: [],
    steps: [],
  });
}

describe('LibraryPanel', () => {
  it('filters by text and selects a meal', async () => {
    const onSelect = jest.fn();
    const onDelete = jest.fn();

    const Wrapper = () => {
      const [text, setText] = useState('');
      return (
        <LibraryPanel
          meals={[meal(1, 'Apple Pie'), meal(2, 'Banana Bread')]}
          text={text}
          type={'All'}
          onTextChange={setText}
          onTypeChange={() => {}}
          onSelectMeal={onSelect}
          onDeleteMeal={onDelete}
        />
      );
    };

    render(<Wrapper />);

    // filter to Banana
    const search = screen.getByLabelText('Search Meals');
    await userEvent.type(search, 'Ban');
    // rows should reflect filter; click the text cell
    const cell = await screen.findByText('Banana Bread');
    await userEvent.click(cell);
    expect(onSelect).toHaveBeenCalled();
  });
});
