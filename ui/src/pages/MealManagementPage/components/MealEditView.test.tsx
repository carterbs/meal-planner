import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MealEditView from './MealEditView';
import { Meal, Ingredient, Step } from '@mealplanner/generated';

jest.mock('../../../api', () => ({
  createMealIngredient: jest.fn(),
  updateMealIngredient: jest.fn(),
  deleteMealIngredient: jest.fn(),
  replaceAllSteps: jest.fn(),
  updateMeal: jest.fn(),
}));

import {
  createMealIngredient,
  updateMealIngredient,
  deleteMealIngredient,
  replaceAllSteps,
  updateMeal as updateMealApi,
} from '../../../api';

function setup(mealOverrides: Partial<Meal> = {}) {
  const meal = new Meal({
    id: 1,
    name: 'Tasty Meal',
    mealType: 'dinner',
    effort: 3,
    hasRedMeat: false,
    url: 'http://example.com',
    ingredients: [],
    steps: [],
    ...mealOverrides,
  } as any);
  const onMealUpdated = jest.fn();
  const onBack = jest.fn();
  const showToast = jest.fn();
  render(
    <MealEditView
      meal={meal}
      onMealUpdated={onMealUpdated}
      onBack={onBack}
      showToast={showToast}
    />,
  );
  return { meal, onMealUpdated, onBack, showToast };
}

describe('MealEditView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders meal details and link when URL exists', () => {
    setup();
    expect(screen.getByText('Tasty Meal')).toBeInTheDocument();
    expect(screen.getByText('View Recipe Online')).toHaveAttribute(
      'href',
      'http://example.com',
    );
  });

  it('toggles edit mode and saves meal on Done (calls updateMeal and onBack)', async () => {
    (updateMealApi as jest.Mock).mockResolvedValue(
      new Meal({
        id: 1,
        name: 'Tasty Meal',
        mealType: 'dinner',
        effort: 3,
        hasRedMeat: false,
        ingredients: [],
        steps: [],
      } as any),
    );
    const { onBack, onMealUpdated } = setup();

    fireEvent.click(screen.getByText('Edit Recipe'));
    fireEvent.click(screen.getByText('Done'));

    await waitFor(() => {
      expect(updateMealApi).toHaveBeenCalled();
      expect(onMealUpdated).toHaveBeenCalled();
      expect(onBack).toHaveBeenCalled();
    });
  });

  it('adds a new ingredient and saves via create API', async () => {
    const updated = new Meal({
      id: 1,
      name: 'Tasty Meal',
      mealType: 'dinner',
      effort: 3,
      hasRedMeat: false,
      ingredients: [
        new Ingredient({ id: 5, name: 'Tomato', quantity: 2, unit: 'pcs' }),
      ],
      steps: [],
    } as any);
    (createMealIngredient as jest.Mock).mockResolvedValue(updated);
    const { onMealUpdated, showToast } = setup();

    fireEvent.click(screen.getByText('Edit Recipe'));
    fireEvent.click(screen.getByText('Add Ingredient'));

    const name = screen.getByLabelText('name');
    fireEvent.change(name, { target: { value: 'Tomato' } });
    const qty = screen.getByLabelText('quantity');
    fireEvent.change(qty, { target: { value: '2' } });
    const unit = screen.getByLabelText('unit');
    fireEvent.change(unit, { target: { value: 'pcs' } });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(createMealIngredient).toHaveBeenCalled();
      expect(onMealUpdated).toHaveBeenCalledWith(updated);
      expect(showToast).toHaveBeenCalledWith('Ingredient added successfully');
    });
  });

  it('edits existing ingredient via update API', async () => {
    const existing = new Ingredient({
      id: 10,
      name: 'Salt',
      quantity: 1,
      unit: 'tsp',
    });
    const updated = new Meal({
      id: 1,
      name: 'Tasty Meal',
      mealType: 'dinner',
      effort: 3,
      hasRedMeat: false,
      ingredients: [
        new Ingredient({ id: 10, name: 'Salt', quantity: 2, unit: 'tsp' }),
      ],
      steps: [],
    } as any);
    (updateMealIngredient as jest.Mock).mockResolvedValue(updated);
    const { onMealUpdated, showToast } = setup({
      ingredients: [existing],
    } as any);

    fireEvent.click(screen.getByText('Edit Recipe'));
    fireEvent.click(screen.getByText('Edit'));
    const qty = screen.getByLabelText('quantity');
    fireEvent.change(qty, { target: { value: '2' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(updateMealIngredient).toHaveBeenCalled();
      expect(onMealUpdated).toHaveBeenCalledWith(updated);
      expect(showToast).toHaveBeenCalledWith('Ingredient updated successfully');
    });
  });

  it('cancels ingredient edit without saving', () => {
    const existing = new Ingredient({
      id: 10,
      name: 'Salt',
      quantity: 1,
      unit: 'tsp',
    });
    setup({ ingredients: [existing] } as any);
    fireEvent.click(screen.getByText('Edit Recipe'));
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Cancel'));
    // fields should be gone
    expect(screen.queryByLabelText('name')).toBeNull();
  });

  it('deletes a newly added (unsaved) ingredient locally', () => {
    const tempIng = new Ingredient({
      id: -123,
      name: 'Temp',
      quantity: 1,
      unit: 'g',
    });
    const { onMealUpdated, showToast } = setup({
      ingredients: [tempIng],
    } as any);
    fireEvent.click(screen.getByText('Edit Recipe'));
    fireEvent.click(screen.getByText('Delete'));
    expect(onMealUpdated).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Ingredient removed');
  });

  it('deletes an existing ingredient via API', async () => {
    const ing = new Ingredient({
      id: 7,
      name: 'Oil',
      quantity: 1,
      unit: 'tbsp',
    });
    const updated = new Meal({
      id: 1,
      name: 'Tasty Meal',
      mealType: 'dinner',
      effort: 3,
      hasRedMeat: false,
      ingredients: [],
      steps: [],
    } as any);
    (deleteMealIngredient as jest.Mock).mockResolvedValue(updated);
    const { onMealUpdated, showToast } = setup({ ingredients: [ing] } as any);

    fireEvent.click(screen.getByText('Edit Recipe'));
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(deleteMealIngredient).toHaveBeenCalled();
      expect(onMealUpdated).toHaveBeenCalledWith(updated);
      expect(showToast).toHaveBeenCalledWith('Ingredient deleted successfully');
    });
  });

  it('saves steps successfully and handles error', async () => {
    const steps = [
      new Step({ id: 1, mealId: 1, stepNumber: 1, instruction: 'Do it' }),
    ];
    const { showToast } = setup({ steps } as any);
    (replaceAllSteps as jest.Mock).mockResolvedValue({});

    fireEvent.click(screen.getByText('Edit Recipe'));
    fireEvent.click(screen.getByText('Save Steps'));
    await waitFor(() => {
      expect(replaceAllSteps).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith('Recipe steps saved successfully');
    });

    (replaceAllSteps as jest.Mock).mockRejectedValue(new Error('bad'));
    fireEvent.click(screen.getByText('Save Steps'));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Error saving steps');
    });
  });

  it('changes meal type and last planned date in edit mode', () => {
    setup();
    fireEvent.click(screen.getByText('Edit Recipe'));
    const combo = screen.getByRole('combobox', { name: /meal type/i });
    fireEvent.mouseDown(combo);
    // pick a distinct option to avoid duplicates on screen
    fireEvent.click(screen.getByRole('option', { name: 'Lunch' }));

    const date = screen.getByLabelText('Last Planned');
    fireEvent.change(date, { target: { value: '2024-01-01' } });
    expect(date.value).toBe('2024-01-01');
  });
});
