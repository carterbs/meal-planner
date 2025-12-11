import { renderHook, act, waitFor } from '@testing-library/react';
import { MealPlanningCheckpointState, MealPlan } from '@mealplanner/generated/api_pb';

const mockGetAgentCheckpoint = jest.fn();
const mockGetMessages = jest
  .fn()
  .mockResolvedValue([{ sender: 'agent', content: 'hi', threadId: 't1' }]);

jest.mock('../../../api', () => ({
  __esModule: true,
  getAgentCheckpoint: (...args: unknown[]) => mockGetAgentCheckpoint(...args),
  getMessages: (...args: unknown[]) => mockGetMessages(...args),
}));

jest.mock('../../../hooks/useSession', () => ({
  __esModule: true,
  default: () => ({
    isResuming: false,
    resumeData: new MealPlanningCheckpointState({
      threadId: 't1',
      currentStep: '',
      mealPlan: new MealPlan({ items: [] }),
    }),
    startNewSession: jest.fn(),
  }),
}));

import useAgentController from './useAgentController';

describe('useAgentController (resume hydration)', () => {
  it('hydrates checkpoint and messages automatically when sessionId exists (resume path)', async () => {
    const checkpoint = new MealPlanningCheckpointState({
      mealPlan: new MealPlan({ items: [] }),
    });
    mockGetAgentCheckpoint.mockResolvedValueOnce(checkpoint);

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
