import { renderHook, act, waitFor } from '@testing-library/react';

// Mock API layer used by the hook (names must start with "mock" for jest.mock factory access)
const mockStartAgentSession = jest
  .fn()
  .mockResolvedValue({
    session: { threadId: 't1', currentStep: '' },
    message: 'hello',
  });
const mockSendAgentMessage = jest.fn().mockResolvedValue({});
const mockGetAgentCheckpoint = jest
  .fn()
  .mockResolvedValue({ state: { mealPlan: { days: [] } } });
const mockGetMessages = jest
  .fn()
  .mockResolvedValue([{ sender: 'agent', content: 'hi' }]);
const mockGoGetShoppingList = jest.fn().mockResolvedValue([]);

jest.mock('../../../api', () => ({
  __esModule: true,
  startAgentSession: (...args: any[]) => mockStartAgentSession(...args),
  sendAgentMessage: (...args: any[]) => mockSendAgentMessage(...args),
  getAgentCheckpoint: (...args: any[]) => mockGetAgentCheckpoint(...args),
  getMessages: (...args: any[]) => mockGetMessages(...args),
  goGetShoppingList: (...args: any[]) => mockGoGetShoppingList(...args),
}));

// Mock useSession to avoid network
// Provide resume path by default to simplify initialization and avoid startAgentSession mismatch
jest.mock('../../../hooks/useSession', () => ({
  __esModule: true,
  default: () => ({
    isResuming: false,
    resumeData: { threadId: 't1', currentStep: '' },
    startNewSession: jest.fn(),
  }),
}));

// Mock generated types to avoid loading large runtime bundle
jest.mock('@mealplanner/generated', () => ({
  __esModule: true,
  ShoppingListItem: class ShoppingListItem {
    ingredient: string;
    quantity: string;
    category: string;
    constructor(args: {
      ingredient?: string;
      quantity?: string;
      category?: string;
    }) {
      this.ingredient = args.ingredient ?? '';
      this.quantity = args.quantity ?? '';
      this.category = args.category ?? '';
    }
  },
  WeeklyMealPlan: class WeeklyMealPlan {},
}));

// Import after mocks are set up
import useAgentController from './useAgentController';

describe('useAgentController', () => {
  it('hydrates messages on resume and can send', async () => {
    const { result } = renderHook(() => useAgentController());
    // allow effects to run for resume hydration
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.session).not.toBeNull();
    await waitFor(() => {
      expect(mockGetMessages).toHaveBeenCalled();
    });

    act(() => {
      result.current.setInput('Hi');
    });

    await act(async () => {
      await result.current.sendMessage();
    });

    expect(mockSendAgentMessage).toHaveBeenCalled();
    expect(result.current.isWorking).toBe(false);
  });

  it('logout clears state', async () => {
    const { result } = renderHook(() => useAgentController());
    await act(async () => {});
    act(() => {
      result.current.logout();
    });
    expect(result.current.session).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.mealPlan).toBeNull();
    expect(result.current.shoppingList).toBeNull();
  });
});
