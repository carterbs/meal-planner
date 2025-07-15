import React from 'react';
import { renderHook, act } from '@testing-library/react';
import useSession from './useSession';

// Helper component for renderHook with React 18
function wrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

describe('useSession', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (global.fetch as jest.Mock) = jest.fn();
    localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
    localStorage.clear();
  });

  test('resumes existing session', async () => {
    localStorage.setItem('sessionId', 'abc');
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          threadId: 'abc',
          current_step: 'planning',
          workflow_type: 'meal_planning',
        }),
    });
    const startSession = jest.fn();
    const { result } = renderHook(() => useSession(startSession), { wrapper });
    await act(async () => {
      jest.runAllTimers();
    });
    expect(result.current.resumeData?.threadId).toBe('abc');
    expect(result.current.isResuming).toBe(false);
    expect(result.current.resumeData?.currentStep).toBe('planning');
  });

  test('clears session when workflow complete', async () => {
    localStorage.setItem('sessionId', 'done');
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ threadId: 'done', current_step: 'complete' }),
    });
    const { result } = renderHook(() => useSession(jest.fn()), { wrapper });
    await act(async () => {
      jest.runAllTimers();
    });
    expect(localStorage.getItem('sessionId')).toBeNull();
    expect(result.current.resumeData).toBeUndefined();
  });

  test('startNewSession abandons existing session', async () => {
    localStorage.setItem('sessionId', 'old');
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ threadId: 'old', current_step: 'planning' }),
      })
      .mockResolvedValueOnce({ ok: true });
    const startSession = jest.fn();
    const { result } = renderHook(() => useSession(startSession), { wrapper });
    await act(async () => {
      jest.runAllTimers();
    });
    await act(async () => {
      await result.current.startNewSession();
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/workflows/old/abandon', {
      method: 'POST',
    });
    expect(localStorage.getItem('sessionId')).toBeNull();
    expect(startSession).toHaveBeenCalled();
  });
});
