import { renderHook, act } from '@testing-library/react';

jest.mock('../../../api', () => ({
  __esModule: true,
  startAgentSession: jest.fn().mockResolvedValue({
    session: { threadId: 't1', currentStep: '' },
    message: 'hi',
  }),
}));

jest.mock('../../../hooks/useSession', () => ({
  __esModule: true,
  default: () => ({
    isResuming: false,
    resumeData: undefined,
    startNewSession: jest.fn(),
  }),
}));

// Import after mocks
// note: direct import of hook is unused in this remocking pattern

describe('useAgentSession', () => {
  it('sets session from resumeData and supports logout', async () => {
    // Remock useSession to provide resumeData and a spyable startNewSession
    const startNewSession = jest.fn();
    jest.doMock('../../../hooks/useSession', () => ({
      __esModule: true,
      default: () => ({
        isResuming: false,
        resumeData: { threadId: 't1', currentStep: '' },
        startNewSession,
      }),
    }));
    const { default: useAgentSessionRemocked } = await import(
      './useAgentSession'
    );
    const { result } = renderHook(() => useAgentSessionRemocked());
    await act(async () => {});
    expect(result.current.session?.threadId).toBe('t1');
    await act(async () => {
      result.current.logout();
    });
    expect(result.current.session).toBeNull();
    expect(startNewSession).toHaveBeenCalled();
  });
});
