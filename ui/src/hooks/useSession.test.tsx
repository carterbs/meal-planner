import React, { useEffect } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import useSession from './useSession';

// Mock generated gateway client and APIs
jest.mock('@mealplanner/generated/dist/gateway/client/index.js', () => ({
  createClient: jest.fn(() => ({})),
  createConfig: jest.fn(() => ({})),
}));

jest.mock('@mealplanner/generated/dist/gateway/index.js', () => ({
  getCheckpointsByThreadId: jest.fn(),
  postShoppinglist: jest.fn(),
  postWorkflowsByThreadIdAbandon: jest.fn(),
}));

import {
  getCheckpointsByThreadId,
  postShoppinglist,
  postWorkflowsByThreadIdAbandon,
} from '@mealplanner/generated/dist/gateway/index.js';

function TestHarness({
  triggerStart = false,
  startSessionMock,
}: {
  triggerStart?: boolean;
  startSessionMock: jest.Mock;
}) {
  const { isResuming, resumeData, startNewSession } =
    useSession(startSessionMock);

  useEffect(() => {
    if (triggerStart) {
      // fire and forget
      void startNewSession();
    }
  }, [triggerStart, startNewSession]);

  return (
    <div>
      <div data-testid="isResuming">{String(isResuming)}</div>
      <div data-testid="hasResumeData">{resumeData ? 'yes' : 'no'}</div>
      <div data-testid="shoppingItems">
        {resumeData?.shoppingList?.items?.length ?? 0}
      </div>
      <button data-testid="start" onClick={() => startNewSession()}>
        start
      </button>
    </div>
  );
}

describe('useSession', () => {
  const startSessionMock = jest.fn(async () => {});

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('does nothing when no session id exists', async () => {
    (getCheckpointsByThreadId as jest.Mock).mockResolvedValue({});

    render(<TestHarness startSessionMock={startSessionMock} />);

    expect(screen.getByTestId('isResuming').textContent).toBe('false');
    expect(screen.getByTestId('hasResumeData').textContent).toBe('no');
    expect(getCheckpointsByThreadId).not.toHaveBeenCalled();
  });

  it('clears invalid session when checkpoints call returns error/no data', async () => {
    localStorage.setItem('sessionId', 't1');
    (getCheckpointsByThreadId as jest.Mock).mockResolvedValue({
      data: null,
      error: 'boom',
    });

    render(<TestHarness startSessionMock={startSessionMock} />);

    await waitFor(() => {
      expect(screen.getByTestId('isResuming').textContent).toBe('false');
      expect(localStorage.getItem('sessionId')).toBeNull();
    });
  });

  it('parses string-encoded checkpoint and fetches shopping list successfully', async () => {
    localStorage.setItem('sessionId', 't2');

    const checkpointState = {
      currentStep: 'step-1',
      mealPlan: {
        days: [{ meal: JSON.stringify({ id: 12 }) }, { meal: { id: 34 } }],
      },
      participants: ['x'],
    };
    const cp = {
      tuple: JSON.stringify({
        checkpoint: JSON.stringify({ state: checkpointState }),
      }),
    };
    (getCheckpointsByThreadId as jest.Mock).mockResolvedValue({
      data: JSON.stringify(cp),
    });
    (postShoppinglist as jest.Mock).mockResolvedValue({
      data: { items: [{ name: 'a' }, { name: 'b' }] },
    });

    render(<TestHarness startSessionMock={startSessionMock} />);

    await waitFor(() => {
      expect(screen.getByTestId('isResuming').textContent).toBe('false');
      expect(screen.getByTestId('hasResumeData').textContent).toBe('yes');
      expect(screen.getByTestId('shoppingItems').textContent).toBe('2');
    });

    expect(getCheckpointsByThreadId).toHaveBeenCalledWith({
      client: expect.any(Object),
      path: { thread_id: 't2' },
    });
    expect(postShoppinglist).toHaveBeenCalledWith({
      client: expect.any(Object),
      body: { plan: [12, 34] },
    });
  });

  it('ignores shopping list errors', async () => {
    localStorage.setItem('sessionId', 't3');
    const cp = {
      tuple: {
        checkpoint: { state: { mealPlan: { days: [{ meal: { id: 1 } }] } } },
      },
    };
    (getCheckpointsByThreadId as jest.Mock).mockResolvedValue({ data: cp });
    (postShoppinglist as jest.Mock).mockRejectedValue(new Error('sl fail'));

    render(<TestHarness startSessionMock={startSessionMock} />);

    await waitFor(() => {
      expect(screen.getByTestId('isResuming').textContent).toBe('false');
      expect(screen.getByTestId('hasResumeData').textContent).toBe('yes');
      expect(screen.getByTestId('shoppingItems').textContent).toBe('0');
    });
  });

  it('removes session id when checkpoint has no state', async () => {
    localStorage.setItem('sessionId', 't4');
    const cp = { tuple: { checkpoint: {} } };
    (getCheckpointsByThreadId as jest.Mock).mockResolvedValue({ data: cp });

    render(<TestHarness startSessionMock={startSessionMock} />);

    await waitFor(() => {
      expect(localStorage.getItem('sessionId')).toBeNull();
      expect(screen.getByTestId('hasResumeData').textContent).toBe('no');
    });
  });

  it('sets resume data when state exists without mealPlan and skips shopping list fetch', async () => {
    localStorage.setItem('sessionId', 't4b');
    const cp = {
      tuple: {
        checkpoint: { state: { currentStep: 'x', participants: ['a'] } },
      },
    };
    (getCheckpointsByThreadId as jest.Mock).mockResolvedValue({ data: cp });

    render(<TestHarness startSessionMock={startSessionMock} />);

    await waitFor(() => {
      expect(screen.getByTestId('isResuming').textContent).toBe('false');
      expect(screen.getByTestId('hasResumeData').textContent).toBe('yes');
      expect(screen.getByTestId('shoppingItems').textContent).toBe('0');
    });

    expect(postShoppinglist).not.toHaveBeenCalled();
  });

  it('returns early when checkpoint key is missing', async () => {
    localStorage.setItem('sessionId', 't5');
    const cp = { tuple: {} };
    (getCheckpointsByThreadId as jest.Mock).mockResolvedValue({ data: cp });

    render(<TestHarness startSessionMock={startSessionMock} />);

    await waitFor(() => {
      expect(screen.getByTestId('isResuming').textContent).toBe('false');
      // sessionId remains, since we did not hit catch branch
      expect(localStorage.getItem('sessionId')).toBe('t5');
      expect(screen.getByTestId('hasResumeData').textContent).toBe('no');
    });
  });

  it('startNewSession without existing session simply starts a new session', async () => {
    render(<TestHarness startSessionMock={startSessionMock} />);

    fireEvent.click(screen.getByTestId('start'));

    await waitFor(() => {
      expect(postWorkflowsByThreadIdAbandon).not.toHaveBeenCalled();
      expect(startSessionMock).toHaveBeenCalledTimes(1);
    });
  });

  it('startNewSession with existing session abandons and clears id before starting', async () => {
    localStorage.setItem('sessionId', 'old-123');
    (getCheckpointsByThreadId as jest.Mock).mockResolvedValue({
      data: { tuple: { checkpoint: { state: {} } } },
    });
    (postWorkflowsByThreadIdAbandon as jest.Mock).mockResolvedValue({});

    render(<TestHarness startSessionMock={startSessionMock} />);

    fireEvent.click(screen.getByTestId('start'));

    await waitFor(() => {
      expect(postWorkflowsByThreadIdAbandon).toHaveBeenCalledWith({
        client: expect.any(Object),
        path: { threadId: 'old-123' },
      });
      expect(localStorage.getItem('sessionId')).toBeNull();
      expect(startSessionMock).toHaveBeenCalledTimes(1);
    });
  });

  it('startNewSession with existing session proceeds even if abandon fails', async () => {
    localStorage.setItem('sessionId', 'old-err');
    (postWorkflowsByThreadIdAbandon as jest.Mock).mockRejectedValue(
      new Error('abandon fail'),
    );
    // Mock checkpoints fetch to avoid undefined .then during mount
    (getCheckpointsByThreadId as jest.Mock).mockResolvedValue({
      data: { tuple: { checkpoint: { state: {} } } },
    });

    render(<TestHarness startSessionMock={startSessionMock} />);

    fireEvent.click(screen.getByTestId('start'));

    await waitFor(() => {
      expect(postWorkflowsByThreadIdAbandon).toHaveBeenCalledWith({
        client: expect.any(Object),
        path: { threadId: 'old-err' },
      });
      expect(localStorage.getItem('sessionId')).toBeNull();
      expect(startSessionMock).toHaveBeenCalledTimes(1);
    });
  });

  it('handles shopping list resolved error payload without updating items', async () => {
    localStorage.setItem('sessionId', 't3b');
    const cp = {
      tuple: {
        checkpoint: { state: { mealPlan: { days: [{ meal: { id: 2 } }] } } },
      },
    };
    (getCheckpointsByThreadId as jest.Mock).mockResolvedValue({ data: cp });
    (postShoppinglist as jest.Mock).mockResolvedValue({
      data: null,
      error: 'bad',
    });

    render(<TestHarness startSessionMock={startSessionMock} />);

    await waitFor(() => {
      expect(screen.getByTestId('isResuming').textContent).toBe('false');
      expect(screen.getByTestId('hasResumeData').textContent).toBe('yes');
      expect(screen.getByTestId('shoppingItems').textContent).toBe('0');
    });
  });

  it('maps missing meal id to 0 when building shopping list request', async () => {
    localStorage.setItem('sessionId', 't7');
    const cp = {
      tuple: {
        checkpoint: { state: { mealPlan: { days: [{ meal: {} as unknown }] } } },
      },
    };
    (getCheckpointsByThreadId as jest.Mock).mockResolvedValue({ data: cp });
    (postShoppinglist as jest.Mock).mockResolvedValue({ data: { items: [] } });

    render(<TestHarness startSessionMock={startSessionMock} />);

    await waitFor(() => {
      expect(postShoppinglist).toHaveBeenCalledWith({
        client: expect.any(Object),
        body: { plan: [0] },
      });
    });
  });

  it('handles fetch checkpoints rejection and clears id', async () => {
    localStorage.setItem('sessionId', 't6');
    (getCheckpointsByThreadId as jest.Mock).mockRejectedValue(new Error('bad'));

    render(<TestHarness startSessionMock={startSessionMock} />);

    await waitFor(() => {
      expect(localStorage.getItem('sessionId')).toBeNull();
      expect(screen.getByTestId('isResuming').textContent).toBe('false');
    });
  });
});
