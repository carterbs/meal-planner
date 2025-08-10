import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { startAgentSession } from '../../../api';
import useSession from '../../../hooks/useSession';
import useAgentSession from './useAgentSession';

// Mock dependencies
jest.mock('../../../api');
jest.mock('../../../hooks/useSession');

const mockStartAgentSession = startAgentSession as jest.MockedFunction<
  typeof startAgentSession
>;
const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useAgentSession', () => {
  const mockStartNewSession = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({
      isResuming: false,
      resumeData: undefined,
      startNewSession: mockStartNewSession,
    });
  });

  describe('initial state', () => {
    it('should initialize with null session and isWorking false', () => {
      const { result } = renderHook(() => useAgentSession());

      expect(result.current.session).toBeNull();
      expect(result.current.isWorking).toBe(false);
      expect(result.current.resumeData).toBeUndefined();
    });
  });

  describe('start function', () => {
    it('should successfully start a session', async () => {
      const mockResult = {
        session: { threadId: 'thread-123', currentStep: 'step1' },
        message: 'Session started',
      };
      mockStartAgentSession.mockResolvedValueOnce(mockResult);

      const { result } = renderHook(() => useAgentSession());

      expect(result.current.isWorking).toBe(false);

      let startResult;
      await act(async () => {
        startResult = await result.current.start();
      });

      expect(result.current.isWorking).toBe(false);
      expect(result.current.session).toEqual(mockResult.session);
      expect(startResult).toEqual(mockResult);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'sessionId',
        'thread-123',
      );
      expect(mockStartAgentSession).toHaveBeenCalledWith(
        ['user'],
        'meal_planning',
      );
    });

    it('should set isWorking true during API call', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockStartAgentSession.mockReturnValueOnce(promise);

      const { result } = renderHook(() => useAgentSession());

      act(() => {
        result.current.start();
      });

      expect(result.current.isWorking).toBe(true);

      await act(async () => {
        resolvePromise!({
          session: { threadId: 'thread-123', currentStep: 'step1' },
        });
        await promise;
      });

      expect(result.current.isWorking).toBe(false);
    });

    it('should handle API errors and still reset isWorking', async () => {
      const error = new Error('API Error');
      mockStartAgentSession.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useAgentSession());

      await act(async () => {
        try {
          await result.current.start();
        } catch (e) {
          expect(e).toBe(error);
        }
      });

      expect(result.current.isWorking).toBe(false);
      expect(result.current.session).toBeNull();
    });
  });

  describe('resume functionality', () => {
    it('should set session from resumeData when available', () => {
      const resumeData = {
        threadId: 'resume-thread',
        currentStep: 'resume-step',
      };
      mockUseSession.mockReturnValue({
        isResuming: false,
        resumeData,
        startNewSession: mockStartNewSession,
      });

      const { result } = renderHook(() => useAgentSession());

      expect(result.current.session).toEqual({
        threadId: 'resume-thread',
        currentStep: 'resume-step',
      });
      expect(result.current.resumeData).toEqual(resumeData);
    });

    it('should handle resumeData with missing currentStep', () => {
      const resumeData = {
        threadId: 'resume-thread',
      };
      mockUseSession.mockReturnValue({
        isResuming: false,
        resumeData,
        startNewSession: mockStartNewSession,
      });

      const { result } = renderHook(() => useAgentSession());

      expect(result.current.session).toEqual({
        threadId: 'resume-thread',
        currentStep: '',
      });
    });

    it('should not set session when resumeData is null', () => {
      mockUseSession.mockReturnValue({
        isResuming: false,
        resumeData: null,
        startNewSession: mockStartNewSession,
      });

      const { result } = renderHook(() => useAgentSession());

      expect(result.current.session).toBeNull();
    });

    it('should not set session when resumeData lacks threadId', () => {
      const resumeData = {
        currentStep: 'step1',
      };
      mockUseSession.mockReturnValue({
        isResuming: false,
        resumeData,
        startNewSession: mockStartNewSession,
      });

      const { result } = renderHook(() => useAgentSession());

      expect(result.current.session).toBeNull();
    });

    it('should prevent duplicate processing of same threadId', () => {
      // We need to create a scenario where the useEffect runs with the same threadId twice
      // This can happen when resumeData changes but threadId stays the same
      const resumeDataBase = { threadId: 'test-thread', currentStep: 'step1' };

      mockUseSession.mockReturnValue({
        isResuming: false,
        resumeData: resumeDataBase,
        startNewSession: mockStartNewSession,
      });

      const { result, rerender } = renderHook(() => useAgentSession());

      expect(result.current.session).toEqual({
        threadId: 'test-thread',
        currentStep: 'step1',
      });

      // Create a new resumeData object with same threadId but different other properties
      // This will cause the dependency array to see the same threadId but the object reference changed
      const resumeDataSameThread = {
        threadId: 'test-thread',
        currentStep: 'step2',
        someOtherProp: 'different' as any, // Add extra prop to make object different
      };

      mockUseSession.mockReturnValue({
        isResuming: false,
        resumeData: resumeDataSameThread,
        startNewSession: mockStartNewSession,
      });

      const sessionBefore = result.current.session;
      rerender();

      // Since the threadId is the same and processedResumeRef already contains 'test-thread',
      // the early return on line 29 should execute and session should remain unchanged
      expect(result.current.session).toBe(sessionBefore);
      expect(result.current.session?.currentStep).toBe('step1'); // Should not change to 'step2'
    });

    it('should process new threadId after previous one', () => {
      let resumeData = {
        threadId: 'thread-1',
        currentStep: 'step1',
      };

      mockUseSession.mockReturnValue({
        isResuming: false,
        resumeData,
        startNewSession: mockStartNewSession,
      });

      const { result, rerender } = renderHook(() => useAgentSession());

      expect(result.current.session).toEqual({
        threadId: 'thread-1',
        currentStep: 'step1',
      });

      // Update resumeData with new threadId
      resumeData = {
        threadId: 'thread-2',
        currentStep: 'step2',
      };
      mockUseSession.mockReturnValue({
        isResuming: false,
        resumeData,
        startNewSession: mockStartNewSession,
      });

      rerender();

      expect(result.current.session).toEqual({
        threadId: 'thread-2',
        currentStep: 'step2',
      });
    });
  });

  describe('logout function', () => {
    it('should clear session and call startNewSession', async () => {
      // First set up a session
      const resumeData = {
        threadId: 'active-thread',
        currentStep: 'active-step',
      };
      mockUseSession.mockReturnValue({
        isResuming: false,
        resumeData,
        startNewSession: mockStartNewSession,
      });

      const { result } = renderHook(() => useAgentSession());
      expect(result.current.session).not.toBeNull();

      await act(async () => {
        result.current.logout();
      });

      expect(result.current.session).toBeNull();
      expect(mockStartNewSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('useSession callback', () => {
    it('should call start function when useSession callback is invoked', async () => {
      const mockResult = {
        session: { threadId: 'callback-thread', currentStep: 'callback-step' },
        message: 'Started via callback',
      };
      mockStartAgentSession.mockResolvedValueOnce(mockResult);

      // Capture the callback passed to useSession
      let capturedCallback: (() => Promise<void>) | undefined;
      mockUseSession.mockImplementation((callback) => {
        capturedCallback = callback;
        return {
          isResuming: false,
          resumeData: undefined,
          startNewSession: mockStartNewSession,
        };
      });

      renderHook(() => useAgentSession());

      expect(capturedCallback).toBeDefined();

      // Call the callback
      await act(async () => {
        await capturedCallback!();
      });

      expect(mockStartAgentSession).toHaveBeenCalledWith(
        ['user'],
        'meal_planning',
      );
    });
  });

  describe('edge case for processedResumeRef early return', () => {
    it('should hit early return when ref already contains threadId', () => {
      // Mock useRef to return a ref that already contains a threadId
      const mockRef = { current: 'existing-thread' };
      const useRefSpy = jest.spyOn(React, 'useRef').mockReturnValue(mockRef);

      const resumeData = {
        threadId: 'existing-thread',
        currentStep: 'step1',
      };

      mockUseSession.mockReturnValue({
        isResuming: false,
        resumeData,
        startNewSession: mockStartNewSession,
      });

      const { result } = renderHook(() => useAgentSession());

      // The session should not be set because the ref already contained this threadId
      expect(result.current.session).toBeNull();

      useRefSpy.mockRestore();
    });
  });
});
