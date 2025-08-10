import { renderHook, act, waitFor } from '@testing-library/react';

// API mocks
const mockGetAgentCheckpoint = jest
  .fn()
  .mockResolvedValue({ state: { mealPlan: { days: [] } } });
const mockGetMessages = jest
  .fn()
  .mockResolvedValue([{ sender: 'agent', content: 'hi' }]);

jest.mock('../../../api', () => ({
  __esModule: true,
  getAgentCheckpoint: (...args: unknown[]) => mockGetAgentCheckpoint(...args),
  getMessages: (...args: unknown[]) => mockGetMessages(...args),
  // other API functions unused in this test
}));

// Provide resumeData so controller hydrates on mount
jest.mock('../../../hooks/useSession', () => ({
  __esModule: true,
  default: () => ({
    isResuming: false,
    resumeData: { threadId: 't1', currentStep: '' },
    startNewSession: jest.fn(),
  }),
}));

// Lightweight generated types mock
jest.mock('@mealplanner/generated', () => ({
  __esModule: true,
  ShoppingListItem: class ShoppingListItem {},
  WeeklyMealPlan: class WeeklyMealPlan {},
}));

// Import after mocks
import useAgentController from './useAgentController';

describe('useAgentController (resume hydration)', () => {
  it('hydrates checkpoint and messages automatically when sessionId exists (resume path)', async () => {
    const { result } = renderHook(() => useAgentController());
    // let mount effects run
    await act(async () => {
      await Promise.resolve();
    });

    // wait for hydration calls
    await waitFor(() => {
      expect(mockGetAgentCheckpoint).toHaveBeenCalledWith('t1');
      expect(mockGetMessages).toHaveBeenCalledWith('t1');
    });

    // session should be non-null due to resumeData
    expect(result.current.session).not.toBeNull();
  });
});
