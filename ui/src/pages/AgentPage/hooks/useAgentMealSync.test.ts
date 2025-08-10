import { renderHook, act, waitFor } from '@testing-library/react';

// Mocks for API functions
const mockGetAgentCheckpoint = jest.fn();
const mockGoGetShoppingList = jest.fn();
const mockSendAgentMessage = jest.fn();

jest.mock('../../../api', () => ({
  __esModule: true,
  getAgentCheckpoint: (...args: any[]) => mockGetAgentCheckpoint(...args),
  goGetShoppingList: (...args: any[]) => mockGoGetShoppingList(...args),
  sendAgentMessage: (...args: any[]) => mockSendAgentMessage(...args),
}));

// Mock converter and generated classes
const mockConvertedPlan = {
  days: [{ dayIndex: 0, mealType: 'dinner' }],
} as any;
jest.mock('../../../utils/mealPlanConverter', () => ({
  __esModule: true,
  convertGatewayMealPlan: jest.fn(() => mockConvertedPlan),
}));

// Use real generated types to avoid state shape mismatches

import useAgentMealSync from './useAgentMealSync';

describe('useAgentMealSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('noop when checkpoint has no state', async () => {
    mockGetAgentCheckpoint.mockResolvedValueOnce({});
    const { result } = renderHook(() => useAgentMealSync());
    await act(async () => {
      await result.current.syncFromCheckpoint('t1');
    });
    expect(result.current.mealPlan).toBeNull();
    expect(result.current.shoppingList).toBeNull();
  });

  it('sets mealPlan and shopping list from checkpoint and gateway shopping list', async () => {
    mockGetAgentCheckpoint.mockResolvedValueOnce({
      state: { mealPlan: { days: [{}] } },
    });
    mockGoGetShoppingList.mockResolvedValueOnce([
      { ingredient: 'Tomato', quantity: '2', category: 'produce' },
      { ingredient: 'Salt', quantity: '', category: '' },
    ]);

    const { result } = renderHook(() => useAgentMealSync());
    await act(async () => {
      await result.current.syncFromCheckpoint('t1');
    });

    await waitFor(() => {
      expect(result.current.mealPlan).not.toBeNull();
      expect(result.current.shoppingList).toEqual([
        expect.objectContaining({
          ingredient: 'Tomato',
          quantity: '2',
          category: 'produce',
        }),
        expect.objectContaining({
          ingredient: 'Salt',
          quantity: '',
          category: '',
        }),
      ]);
    });
  });

  it('ignores shopping list errors but sets meal plan', async () => {
    mockGetAgentCheckpoint.mockResolvedValueOnce({
      state: { mealPlan: { days: [{}] } },
    });
    mockGoGetShoppingList.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useAgentMealSync());
    await act(async () => {
      await result.current.syncFromCheckpoint('t1');
    });
    await waitFor(() => {
      expect(result.current.mealPlan).not.toBeNull();
      expect(result.current.shoppingList).toBeNull();
    });
  });

  it('send calls API and applies initial state meal plan and shopping list when present', async () => {
    mockSendAgentMessage.mockResolvedValueOnce({
      initialState: {
        state: { mealPlan: { days: [{}] } },
        mealPlan: {
          shoppingList: [
            { ingredient: 'Oil', quantity: '1', category: 'pantry' },
          ],
        },
      },
    });
    const { result } = renderHook(() => useAgentMealSync());
    await act(async () => {
      await result.current.send('t1', 'hello');
    });
    expect(mockSendAgentMessage).toHaveBeenCalledWith(
      't1',
      'hello',
      'user',
      true,
    );
    await waitFor(() => {
      expect(result.current.mealPlan).not.toBeNull();
      expect(result.current.shoppingList).toEqual([
        expect.objectContaining({
          ingredient: 'Oil',
          quantity: '1',
          category: 'pantry',
        }),
      ]);
    });
  });
});
