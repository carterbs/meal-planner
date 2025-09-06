import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import MealManagementPage from './MealManagementPage';
import { Meal } from '@mealplanner/generated';
import { Timestamp } from '@bufbuild/protobuf';

// Mock meals API used by controller and editor
const mockGetMeals = jest.fn();
const mockUpdateMeal = jest.fn();
const mockDeleteMeal = jest.fn();
const mockCreateMeal = jest.fn();

jest.mock('../../api/mealsApi', () => ({
  __esModule: true,
  getMeals: (...args: unknown[]) => mockGetMeals(...args),
  updateMeal: (...args: unknown[]) => mockUpdateMeal(...args),
  deleteMeal: (...args: unknown[]) => mockDeleteMeal(...args),
  createMeal: (...args: unknown[]) => mockCreateMeal(...args),
}));

function meal(id: number, name: string): Meal {
  return new Meal({
    id,
    name,
    effort: 3,
    hasRedMeat: false,
    url: '',
    mealType: 'dinner',
    ingredients: [],
    steps: [],
  });
}

describe('MealManagementPage integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Browse -> Select -> Edit -> Save -> Back -> Browse reflects updates', async () => {
    // initial list
    mockGetMeals.mockResolvedValueOnce([meal(1, 'A')]);

    render(<MealManagementPage showToast={() => {}} />);

    // Wait for list and select row
    const row = await screen.findByText('A');
    await userEvent.click(row);

    // Enter edit mode then save (Done)
    const editBtn = await screen.findByRole('button', { name: /edit recipe/i });
    await userEvent.click(editBtn);

    // Prepare update and subsequent browse refetch
    mockUpdateMeal.mockResolvedValueOnce(
      new Meal({
        id: 1,
        name: 'A',
        effort: 3,
        hasRedMeat: false,
        url: '',
        mealType: 'dinner',
        steps: [],
        ingredients: [],
        lastPlanned: Timestamp.fromDate(new Date()),
      }),
    );
    mockGetMeals.mockResolvedValueOnce([meal(1, 'A updated')]);

    const doneBtn = await screen.findByRole('button', { name: /done/i });
    await userEvent.click(doneBtn);

    // Wait until updated row visible
    const updatedRow = await screen.findByText('A updated');
    expect(updatedRow).toBeInTheDocument();
    expect(mockGetMeals).toHaveBeenCalledTimes(2);
    expect(mockUpdateMeal).toHaveBeenCalled();
  });

  it('Delete a meal from browse clears it from the list', async () => {
    mockGetMeals.mockResolvedValueOnce([meal(1, 'A'), meal(2, 'B')]);
    mockDeleteMeal.mockResolvedValueOnce('ok');

    render(<MealManagementPage showToast={() => {}} />);

    // Wait for row and click its delete button
    const rowA = await screen.findByText('A');
    expect(rowA).toBeInTheDocument();
    const deleteButtons = await screen.findAllByRole('button', {
      name: /delete/i,
    });
    // Click the first delete (mapped to meal id 1 in order)
    await userEvent.click(deleteButtons[0]);

    // Row A should be gone
    await waitFor(() => expect(screen.queryByText('A')).toBeNull());
    expect(mockDeleteMeal).toHaveBeenCalledWith(1);
  });

  it('Add -> Create recipe -> returns to browse and shows new item', async () => {
    // initial browse
    mockGetMeals.mockResolvedValueOnce([meal(1, 'A')]);

    render(<MealManagementPage showToast={() => {}} />);

    // Click Add Recipe in header
    const addBtn = await screen.findByRole('button', { name: /add recipe/i });
    await userEvent.click(addBtn);

    // Fill AddRecipeForm minimally
    const nameInput = await screen.findByLabelText(/recipe name/i);
    await userEvent.type(nameInput, 'New Meal');
    const rawIngredients = await screen.findByLabelText(/paste ingredients/i);
    await userEvent.type(rawIngredients, '1 cup sugar');
    const processBtn = await screen.findByRole('button', {
      name: /process ingredients/i,
    });
    await userEvent.click(processBtn);

    // Mock create -> browse refetch contains new
    mockCreateMeal.mockResolvedValueOnce(meal(3, 'New Meal'));
    mockGetMeals.mockResolvedValueOnce([meal(1, 'A'), meal(3, 'New Meal')]);

    const submitButtons = await screen.findAllByRole('button', {
      name: /^add recipe$/i,
    });
    await userEvent.click(submitButtons[1]);

    // Back on browse with new item visible
    const newRow = await screen.findByText('New Meal');
    expect(newRow).toBeInTheDocument();
    expect(mockCreateMeal).toHaveBeenCalled();
  });
});
