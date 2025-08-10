import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import useSession from './useSession';

import {
  getCheckpointsByThreadId,
  postWorkflowsByThreadIdAbandon,
  postShoppinglist,
} from '@mealplanner/generated/dist/gateway/index.js';

// Mock the generated gateway client
jest.mock('@mealplanner/generated/dist/gateway/index.js', () => ({
  getCheckpointsByThreadId: jest.fn(),
  postWorkflowsByThreadIdAbandon: jest.fn(),
  postShoppinglist: jest.fn(),
}));

// Mock the client creation
jest.mock('@mealplanner/generated/dist/gateway/client/index.js', () => ({
  createClient: jest.fn(() => ({})),
  createConfig: jest.fn(() => ({})),
}));

const mockGetCheckpoints = getCheckpointsByThreadId as jest.MockedFunction<
  typeof getCheckpointsByThreadId
>;
const mockAbandonWorkflow =
  postWorkflowsByThreadIdAbandon as jest.MockedFunction<
    typeof postWorkflowsByThreadIdAbandon
  >;
const mockShoppingList = postShoppinglist as jest.MockedFunction<
  typeof postShoppinglist
>;

// Helper component for renderHook with React 18
function wrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

describe('useSession', () => {
  beforeEach(() => {
    // Use real timers for proper async behavior
    jest.useRealTimers();
    localStorage.clear();
    jest.clearAllMocks();

    // Set up default mock implementations that return promises
    mockGetCheckpoints.mockResolvedValue({
      data: { tuple: null },
      error: null,
    } as any);

    mockAbandonWorkflow.mockResolvedValue({
      data: null,
      error: null,
    } as any);

    mockShoppingList.mockResolvedValue({
      data: { items: [] },
      error: null,
    } as any);
  });

  afterEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
  });

  test('resumes existing session', async () => {
    localStorage.setItem('sessionId', 'abc');
    mockGetCheckpoints.mockResolvedValueOnce({
      data: {
        tuple: {
          checkpoint: {
            state: {
              threadId: 'abc',
              currentStep: 'planning',
              mealPlan: { days: [] },
            },
          },
        },
      },
      error: null,
    } as any);
    mockShoppingList.mockResolvedValueOnce({
      data: { items: [] },
      error: null,
    } as any);

    const startSession = jest.fn();
    const { result } = renderHook(() => useSession(startSession), { wrapper });

    // Wait for the hook to complete its async operations
    await waitFor(() => expect(result.current.resumeData?.threadId).toBe('abc'));
    await waitFor(() => expect(result.current.isResuming).toBe(false));

    expect(result.current.resumeData?.currentStep).toBe('planning');
  });

  test('clears session when workflow complete', async () => {
    localStorage.setItem('sessionId', 'done');
    mockGetCheckpoints.mockResolvedValueOnce({
      data: {
        tuple: {
          checkpoint: {
            state: null, // No state means workflow is complete
          },
        },
      },
      error: null,
    } as any);

    const { result } = renderHook(() => useSession(jest.fn()), { wrapper });

    // Wait for the hook to complete its async operations
    await waitFor(() => {
      expect(localStorage.getItem('sessionId')).toBeNull();
    });

    expect(result.current.resumeData).toBeUndefined();
  });

  test('handles missing checkpoint gracefully', async () => {
    localStorage.setItem('sessionId', 'missing');
    mockGetCheckpoints.mockResolvedValueOnce({
      data: { tuple: null },
      error: null,
    } as any);

    const { result } = renderHook(() => useSession(jest.fn()), { wrapper });

    // Wait for the hook to complete its async operations
    await waitFor(() => {
      expect(result.current.resumeData).toBeUndefined();
    });

    expect(localStorage.getItem('sessionId')).toBeNull();
  });

  test('handles checkpoint fetch error', async () => {
    localStorage.setItem('sessionId', 'error');
    mockGetCheckpoints.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useSession(jest.fn()), { wrapper });

    // Wait for the hook to complete its async operations
    await waitFor(() => {
      expect(result.current.resumeData).toBeUndefined();
    });

    expect(localStorage.getItem('sessionId')).toBeNull();
  });

  test('starts new session when none exists', async () => {
    const startSession = jest.fn();
    const { result } = renderHook(() => useSession(startSession), { wrapper });

    expect(result.current.resumeData).toBeUndefined();
    expect(result.current.isResuming).toBe(false);
    expect(startSession).not.toHaveBeenCalled();
  });

  test('starts new session and abandons existing', async () => {
    localStorage.setItem('sessionId', 'abandon');
    mockAbandonWorkflow.mockResolvedValueOnce({
      data: null,
      error: null,
    } as any);

    const startSession = jest.fn();
    const { result } = renderHook(() => useSession(startSession), { wrapper });

    act(() => {
      result.current.startNewSession();
    });

    await waitFor(() => {
      expect(mockAbandonWorkflow).toHaveBeenCalledWith({
        client: {},
        path: { threadId: 'abandon' },
      });
    });

    expect(localStorage.getItem('sessionId')).toBeNull();
    expect(startSession).toHaveBeenCalled();
  });

  test('handles abandon workflow error during start new session', async () => {
    localStorage.setItem('sessionId', 'abandon-error');
    mockAbandonWorkflow.mockRejectedValueOnce(new Error('Abandon failed'));

    const startSession = jest.fn();
    const { result } = renderHook(() => useSession(startSession), { wrapper });

    act(() => {
      result.current.startNewSession();
    });

    await waitFor(() => {
      expect(mockAbandonWorkflow).toHaveBeenCalledWith({
        client: {},
        path: { threadId: 'abandon-error' },
      });
    });

    // Session should still be cleared even if abandon fails
    expect(localStorage.getItem('sessionId')).toBeNull();
    expect(startSession).toHaveBeenCalled();
  });

  test('resumes session with shopping list', async () => {
    localStorage.setItem('sessionId', 'shopping');
    mockGetCheckpoints.mockResolvedValueOnce({
      data: {
        tuple: {
          checkpoint: {
            state: {
              threadId: 'shopping',
              currentStep: 'shopping',
              mealPlan: { days: [] },
            },
          },
        },
      },
      error: null,
    } as any);
    mockShoppingList.mockResolvedValueOnce({
      data: { items: ['item1', 'item2'] },
      error: null,
    } as any);

    const { result } = renderHook(() => useSession(jest.fn()), { wrapper });

    // Wait for the hook to complete its async operations
    await waitFor(() => {
      expect(result.current.resumeData?.shoppingList).toEqual([
        'item1',
        'item2',
      ]);
    });
  });

  test('handles shopping list fetch error', async () => {
    localStorage.setItem('sessionId', 'shopping-error');
    mockGetCheckpoints.mockResolvedValueOnce({
      data: {
        tuple: {
          checkpoint: {
            state: {
              threadId: 'shopping-error',
              currentStep: 'shopping',
              mealPlan: { days: [] },
            },
          },
        },
      },
      error: null,
    } as any);
    mockShoppingList.mockResolvedValueOnce({
      data: null,
      error: { message: 'Failed to fetch shopping list' },
    } as any);

    const { result } = renderHook(() => useSession(jest.fn()), { wrapper });

    // Wait for the hook to complete its async operations
    await waitFor(() => {
      expect(result.current.resumeData?.threadId).toBe('shopping-error');
    });

    expect(result.current.resumeData?.shoppingList).toBeUndefined();
  });

  test('handles checkpoint rejection', async () => {
    localStorage.setItem('sessionId', 'rejected');
    mockGetCheckpoints.mockResolvedValueOnce({
      data: {
        tuple: {
          checkpoint: {
            state: {
              threadId: 'rejected',
              currentStep: 'rejected',
              mealPlan: { days: [] },
            },
          },
        },
      },
      error: null,
    } as any);

    const { result } = renderHook(() => useSession(jest.fn()), { wrapper });

    // Wait for the hook to complete its async operations
    await waitFor(() => {
      expect(result.current.resumeData?.threadId).toBe('rejected');
    });

    expect(result.current.resumeData?.currentStep).toBe('rejected');
  });

  test('handles meal plan with finalized state', async () => {
    localStorage.setItem('sessionId', 'finalized');
    mockGetCheckpoints.mockResolvedValueOnce({
      data: {
        tuple: {
          checkpoint: {
            state: {
              threadId: 'finalized',
              currentStep: 'finalized',
              mealPlan: { days: ['Monday', 'Tuesday'] },
            },
          },
        },
      },
      error: null,
    } as any);

    const { result } = renderHook(() => useSession(jest.fn()), { wrapper });

    // Wait for the hook to complete its async operations
    await waitFor(() => {
      expect(result.current.resumeData?.threadId).toBe('finalized');
    });

    expect(result.current.resumeData?.currentStep).toBe('finalized');
    expect(result.current.resumeData?.mealPlan).toEqual({
      days: ['Monday', 'Tuesday'],
    });
  });

  test('handles multiple session operations', async () => {
    localStorage.setItem('sessionId', 'multi');
    mockGetCheckpoints.mockResolvedValueOnce({
      data: {
        tuple: {
          checkpoint: {
            state: {
              threadId: 'multi',
              currentStep: 'planning',
              mealPlan: { days: [] },
            },
          },
        },
      },
      error: null,
    } as any);
    mockShoppingList.mockResolvedValueOnce({
      data: { items: [] },
      error: null,
    } as any);
    mockAbandonWorkflow.mockResolvedValueOnce({
      data: null,
      error: null,
    } as any);

    const { result } = renderHook(() => useSession(jest.fn()), { wrapper });

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.resumeData?.threadId).toBe('multi');
    });

    // Test start new session which abandons existing
    const startSession = jest.fn();
    const { result: newResult } = renderHook(() => useSession(startSession), {
      wrapper,
    });

    act(() => {
      newResult.current.startNewSession();
    });

    await waitFor(() => {
      expect(mockAbandonWorkflow).toHaveBeenCalledWith({
        client: {},
        path: { threadId: 'multi' },
      });
    });

    expect(localStorage.getItem('sessionId')).toBeNull();
  });

  test('handles session state transitions', async () => {
    localStorage.setItem('sessionId', 'transition');
    mockGetCheckpoints.mockResolvedValueOnce({
      data: {
        tuple: {
          checkpoint: {
            state: {
              threadId: 'transition',
              currentStep: 'planning',
              mealPlan: { days: [] },
            },
          },
        },
      },
      error: null,
    } as any);
    mockShoppingList.mockResolvedValueOnce({
      data: { items: [] },
      error: null,
    } as any);

    const { result } = renderHook(() => useSession(jest.fn()), { wrapper });

    // Wait for the hook to complete its async operations
    await waitFor(() => {
      expect(result.current.resumeData?.threadId).toBe('transition');
    });

    expect(result.current.resumeData?.currentStep).toBe('planning');
    expect(result.current.isResuming).toBe(false);
  });
});
