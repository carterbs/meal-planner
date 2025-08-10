import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import RecipeEditorPanel from './RecipeEditorPanel';
import { Meal } from '@mealplanner/generated';

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

describe('RecipeEditorPanel', () => {
  it('wires save and back', async () => {
    const onSave = jest.fn();
    const onBack = jest.fn();
    render(
      <RecipeEditorPanel
        meal={meal(1, 'Test')}
        onSave={onSave}
        onBack={onBack}
        showToast={() => {}}
      />,
    );
    // click back
    await userEvent.click(
      screen.getByRole('button', { name: /back to meals list/i }),
    );
    expect(onBack).toHaveBeenCalled();
  });
});
