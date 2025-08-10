import { renderHook, act, waitFor } from '@testing-library/react';
import { Meal } from '@mealplanner/generated';

// Mock meals API
const mockGetMeals = jest.fn();
const mockDeleteMeal = jest.fn();

jest.mock('../../../api/mealsApi', () => ({
  __esModule: true,
  getMeals: (...args: any[]) => mockGetMeals(...args),
  deleteMeal: (...args: any[]) => mockDeleteMeal(...args),
}));

// Import after mocks
import useMealManagementController from './useMealManagementController';

function createMeal(
  id: number,
  name: string,
  mealType: 'breakfast' | 'lunch' | 'dinner' = 'dinner',
): Meal {
  return new Meal({
    id,
    name,
    effort: 3,
    hasRedMeat: false,
    url: '',
    mealType,
    ingredients: [],
    steps: [],
  });
}

describe('useMealManagementController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches meals on mount and on type filter change', async () => {
    mockGetMeals.mockResolvedValueOnce([createMeal(1, 'A')]);

    const { result } = renderHook(() => useMealManagementController());

    // initial fetch on mount with All -> undefined type
    await waitFor(() => expect(mockGetMeals).toHaveBeenCalledTimes(1));
    expect(mockGetMeals).toHaveBeenLastCalledWith(undefined);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.meals.map((m) => m.name)).toEqual(['A']);

    // change type -> triggers fetch with lowercase
    mockGetMeals.mockResolvedValueOnce([createMeal(2, 'B', 'breakfast')]);
    act(() => {
      result.current.setFilters({ text: '', type: 'Breakfast' });
    });
    await waitFor(() => expect(mockGetMeals).toHaveBeenCalledTimes(2));
    expect(mockGetMeals).toHaveBeenLastCalledWith('breakfast');
    await waitFor(() =>
      expect(result.current.meals.map((m) => m.name)).toEqual(['B']),
    );
  });

  it('selects a meal and navigates to edit; going back to browse refetches', async () => {
    mockGetMeals.mockResolvedValueOnce([createMeal(1, 'A')]);
    const { result } = renderHook(() => useMealManagementController());
    await waitFor(() => expect(mockGetMeals).toHaveBeenCalledTimes(1));

    const meal = createMeal(1, 'A');
    act(() => {
      result.current.selectMeal(meal);
    });
    expect(result.current.selectedMeal?.id).toBe(1);
    expect(result.current.currentView).toBe('edit');

    mockGetMeals.mockResolvedValueOnce([createMeal(1, 'A updated')]);
    act(() => {
      result.current.goToBrowse();
    });
    await waitFor(() => expect(mockGetMeals).toHaveBeenCalledTimes(2));
    expect(result.current.currentView).toBe('browse');
    await waitFor(() => expect(result.current.meals[0].name).toBe('A updated'));
  });

  it('deletes a meal and clears selection if needed', async () => {
    const m1 = createMeal(1, 'A');
    const m2 = createMeal(2, 'B');
    mockGetMeals.mockResolvedValueOnce([m1, m2]);
    mockDeleteMeal.mockResolvedValueOnce('ok');

    const { result } = renderHook(() => useMealManagementController());
    await waitFor(() => expect(mockGetMeals).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.selectMeal(m1);
    });
    expect(result.current.selectedMeal?.id).toBe(1);

    await act(async () => {
      await result.current.deleteMeal(m1);
    });
    expect(mockDeleteMeal).toHaveBeenCalledWith(1);
    expect(result.current.meals.map((m) => m.id)).toEqual([2]);
    expect(result.current.selectedMeal).toBeNull();
  });

  it('onMealUpdated updates meal in list', async () => {
    const m1 = createMeal(1, 'A');
    mockGetMeals.mockResolvedValueOnce([m1]);
    const { result } = renderHook(() => useMealManagementController());
    await waitFor(() => expect(mockGetMeals).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.onMealUpdated(createMeal(1, 'A1'));
    });
    expect(result.current.meals[0].name).toBe('A1');
  });

  it('sets error when fetch fails', async () => {
    mockGetMeals.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useMealManagementController());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.loading).toBe(false);
  });
});
