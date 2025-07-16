import React from 'react';
import { renderHook, act } from '@testing-library/react';
import useSession from './useSession';
import { mockLocalStorage, errorUtils, loadingUtils } from '../test-utils';

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

import { getCheckpointsByThreadId, postWorkflowsByThreadIdAbandon, postShoppinglist } from '@mealplanner/generated/dist/gateway/index.js';

const mockGetCheckpoints = getCheckpointsByThreadId as jest.MockedFunction<typeof getCheckpointsByThreadId>;
const mockAbandonWorkflow = postWorkflowsByThreadIdAbandon as jest.MockedFunction<typeof postWorkflowsByThreadIdAbandon>;
const mockShoppingList = postShoppinglist as jest.MockedFunction<typeof postShoppinglist>;

// Helper component for renderHook with React 18
function wrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

describe('useSession', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
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
    
    await act(async () => {
      jest.runAllTimers();
      // Wait for promises to resolve
      await Promise.resolve();
    });

    expect(result.current.resumeData?.threadId).toBe('abc');
    expect(result.current.isResuming).toBe(false);
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
    
    await act(async () => {
      jest.runAllTimers();
      await Promise.resolve();
    });

    expect(localStorage.getItem('sessionId')).toBeNull();
    expect(result.current.resumeData).toBeUndefined();
  });

  test('startNewSession abandons existing session', async () => {
    localStorage.setItem('sessionId', 'old');
    mockGetCheckpoints.mockResolvedValueOnce({
      data: {
        tuple: {
          checkpoint: {
            state: {
              threadId: 'old',
              currentStep: 'planning',
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
      data: {},
      error: null,
    } as any);

    const startSession = jest.fn();
    const { result } = renderHook(() => useSession(startSession), { wrapper });
    
    await act(async () => {
      jest.runAllTimers();
      await Promise.resolve();
    });
    
    await act(async () => {
      await result.current.startNewSession();
    });

    expect(mockAbandonWorkflow).toHaveBeenCalledWith({
      client: {},
      path: { threadId: 'old' },
    });
    expect(localStorage.getItem('sessionId')).toBeNull();
    expect(startSession).toHaveBeenCalled();
  });

  test('persists session state across browser refreshes', async () => {
    const sessionData = {
      threadId: 'persistent-123',
      currentStep: 'planning',
      mealPlan: { days: [] },
    };
    
    localStorage.setItem('sessionId', sessionData.threadId);
    mockGetCheckpoints.mockResolvedValueOnce({
      data: {
        tuple: {
          checkpoint: {
            state: sessionData,
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
    
    await act(async () => {
      jest.runAllTimers();
      await Promise.resolve();
    });
    
    expect(result.current.resumeData?.threadId).toBe('persistent-123');
    expect(localStorage.getItem('sessionId')).toBe('persistent-123');
  });

  test('handles session timeout gracefully', async () => {
    localStorage.setItem('sessionId', 'timeout-session');
    mockGetCheckpoints.mockRejectedValueOnce(errorUtils.timeoutError());
    
    const { result } = renderHook(() => useSession(jest.fn()), { wrapper });
    
    await act(async () => {
      jest.runAllTimers();
      await Promise.resolve();
    });
    
    expect(result.current.resumeData).toBeUndefined();
    // The hook removes the sessionId on error
    expect(localStorage.getItem('sessionId')).toBeNull();
  });

  test('clears sensitive data on logout', async () => {
    localStorage.setItem('sessionId', 'sensitive-session');
    
    // Mock initial checkpoint call that happens on mount
    mockGetCheckpoints.mockResolvedValueOnce({
      data: {
        tuple: {
          checkpoint: {
            state: {
              threadId: 'sensitive-session',
              currentStep: 'active',
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
    
    // Mock abandon call for startNewSession
    mockAbandonWorkflow.mockResolvedValueOnce({
      data: {},
      error: null,
    } as any);
    
    const startSession = jest.fn();
    const { result } = renderHook(() => useSession(startSession), { wrapper });
    
    await act(async () => {
      jest.runAllTimers();
      await Promise.resolve();
    });
    
    await act(async () => {
      await result.current.startNewSession();
    });
    
    expect(localStorage.getItem('sessionId')).toBeNull();
    expect(startSession).toHaveBeenCalled();
  });

  test('prevents multiple simultaneous sessions', async () => {
    localStorage.setItem('sessionId', 'existing-session');
    
    // Mock initial checkpoint call that happens on mount
    mockGetCheckpoints.mockResolvedValueOnce({
      data: {
        tuple: {
          checkpoint: {
            state: {
              threadId: 'existing-session',
              currentStep: 'active',
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
    
    // Mock the abandon call that will happen when startNewSession is called
    mockAbandonWorkflow.mockResolvedValueOnce({
      data: {},
      error: null,
    } as any);
    
    const startSession = jest.fn();
    const { result } = renderHook(() => useSession(startSession), { wrapper });
    
    await act(async () => {
      jest.runAllTimers();
      await Promise.resolve();
    });
    
    // Directly call startNewSession (simulating user clicking start button)
    await act(async () => {
      await result.current.startNewSession();
    });
    
    expect(mockAbandonWorkflow).toHaveBeenCalledWith({
      client: {},
      path: { threadId: 'existing-session' },
    });
    expect(startSession).toHaveBeenCalled();
  });

  test('handles network errors during session resume', async () => {
    localStorage.setItem('sessionId', 'network-error-session');
    mockGetCheckpoints.mockRejectedValueOnce(errorUtils.networkError());
    
    const { result } = renderHook(() => useSession(jest.fn()), { wrapper });
    
    await act(async () => {
      jest.runAllTimers();
      await Promise.resolve();
    });
    
    expect(result.current.resumeData).toBeUndefined();
    expect(localStorage.getItem('sessionId')).toBeNull();
  });
});