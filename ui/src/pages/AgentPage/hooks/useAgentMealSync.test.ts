import { renderHook, act, waitFor } from '@testing-library/react';
import {
  MealPlan,
  MealPlanItem,
  Meal,
  MealSlot,
  MealPlanningCheckpointState,
  ShoppingListItem,
} from '@mealplanner/generated/api_pb';

const mockGetAgentCheckpoint = jest.fn();
const mockGoGetShoppingList = jest.fn();
const mockSendAgentMessage = jest.fn();

jest.mock('../../../api', () => ({
  __esModule: true,
  getAgentCheckpoint: (...args: unknown[]) => mockGetAgentCheckpoint(...args),
  goGetShoppingList: (...args: unknown[]) => mockGoGetShoppingList(...args),
  sendAgentMessage: (...args: unknown[]) => mockSendAgentMessage(...args),
}));

import useAgentMealSync from './useAgentMealSync';

describe('useAgentMealSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when checkpoint is empty', async () => {
    mockGetAgentCheckpoint.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAgentMealSync());

    await act(async () => {
      await result.current.syncFromCheckpoint('thread');
    });

    expect(result.current.mealPlan).toBeNull();
    expect(result.current.shoppingList).toBeNull();
  });

  it('sets meal plan and shopping list from checkpoint', async () => {
    const checkpoint = new MealPlanningCheckpointState({
      mealPlan: new MealPlan({
        items: [
          new MealPlanItem({
            dayIndex: 0,
            mealType: MealSlot.LUNCH,
            mealSnapshot: new Meal({ id: 5, name: 'Salad' }),
          }),
        ],
      }),
    });
    mockGetAgentCheckpoint.mockResolvedValueOnce(checkpoint);
    mockGoGetShoppingList.mockResolvedValueOnce([
      new ShoppingListItem({ ingredient: 'Lettuce' }),
    ]);

    const { result } = renderHook(() => useAgentMealSync());

    await act(async () => {
      await result.current.syncFromCheckpoint('thread');
    });

    await waitFor(() => {
      expect(result.current.mealPlan?.items.length).toBe(1);
      expect(result.current.shoppingList).toEqual([
        expect.objectContaining({ ingredient: 'Lettuce' }),
      ]);
    });
  });

  it('ignores shopping list errors but keeps meal plan', async () => {
    const checkpoint = new MealPlanningCheckpointState({
      mealPlan: new MealPlan({
        items: [
          new MealPlanItem({
            dayIndex: 1,
            mealType: MealSlot.DINNER,
            mealSnapshot: new Meal({ id: 8 }),
          }),
        ],
      }),
    });
    mockGetAgentCheckpoint.mockResolvedValueOnce(checkpoint);
    mockGoGetShoppingList.mockRejectedValueOnce(new Error('fail'));

    const { result } = renderHook(() => useAgentMealSync());

    await act(async () => {
      await result.current.syncFromCheckpoint('thread');
    });

    await waitFor(() => {
      expect(result.current.mealPlan?.items.length).toBe(1);
      expect(result.current.shoppingList).toBeNull();
    });
  });

  it('send delegates to API with interactive flag', async () => {
    mockSendAgentMessage.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAgentMealSync());

    await act(async () => {
      await result.current.send('thread', 'hello');
    });

    expect(mockSendAgentMessage).toHaveBeenCalledWith(
      'thread',
      'hello',
      'user',
      true,
    );
  });
});
