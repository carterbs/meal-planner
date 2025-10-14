import React, { useEffect } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import {
  MealPlanningCheckpointState,
  MealPlan,
  MealPlanItem,
  Meal,
  MealSlot,
  ShoppingListItem,
} from '@mealplanner/generated/api_pb';
import useSession from './useSession';

jest.mock('@mealplanner/generated/gateway/client', () => ({
  createClient: jest.fn(() => ({})),
  createConfig: jest.fn(() => ({})),
}));

jest.mock('@mealplanner/generated/gateway', () => ({
  postWorkflowsByThreadIdAbandon: jest.fn(),
}));

jest.mock('../api', () => ({
  getAgentCheckpoint: jest.fn(),
  goGetShoppingList: jest.fn(),
}));

import { postWorkflowsByThreadIdAbandon } from '@mealplanner/generated/gateway';
import { getAgentCheckpoint, goGetShoppingList } from '../api';

function Harness({
  triggerStart = false,
  startSessionMock,
}: {
  triggerStart?: boolean;
  startSessionMock: jest.Mock;
}) {
  const { isResuming, resumeData, startNewSession } = useSession(startSessionMock);

  useEffect(() => {
    if (triggerStart) {
      void startNewSession();
    }
  }, [triggerStart, startNewSession]);

  return (
    <div>
      <div data-testid="isResuming">{String(isResuming)}</div>
      <div data-testid="hasResume">{resumeData ? 'yes' : 'no'}</div>
      <div data-testid="shoppingCount">
        {resumeData?.shoppingList?.items.length ?? 0}
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
    jest.resetAllMocks();
    localStorage.clear();
  });

  it('does nothing when no session id exists', () => {
    render(<Harness startSessionMock={startSessionMock} />);

    expect(screen.getByTestId('isResuming').textContent).toBe('false');
    expect(getAgentCheckpoint).not.toHaveBeenCalled();
  });

  it('clears an invalid stored session', async () => {
    localStorage.setItem('sessionId', 'thread');
    (getAgentCheckpoint as jest.Mock).mockResolvedValue(undefined);

    render(<Harness startSessionMock={startSessionMock} />);

    await waitFor(() => {
      expect(localStorage.getItem('sessionId')).toBeNull();
      expect(screen.getByTestId('hasResume').textContent).toBe('no');
    });
  });

  it('hydrates resume data and fetches shopping list', async () => {
    localStorage.setItem('sessionId', 'thread');
    const mealPlan = new MealPlan({
      items: [
        new MealPlanItem({
          dayIndex: 0,
          mealType: MealSlot.BREAKFAST,
          mealSnapshot: new Meal({ id: 7 }),
        }),
      ],
    });
    const checkpoint = new MealPlanningCheckpointState({
      threadId: '',
      currentStep: 'plan',
      mealPlan,
    });
    (getAgentCheckpoint as jest.Mock).mockResolvedValue(checkpoint);
    (goGetShoppingList as jest.Mock).mockResolvedValue([
      new ShoppingListItem({ ingredient: 'Milk' }),
      new ShoppingListItem({ ingredient: 'Eggs' }),
    ]);

    render(<Harness startSessionMock={startSessionMock} />);

    await waitFor(() => {
      expect(screen.getByTestId('hasResume').textContent).toBe('yes');
      expect(screen.getByTestId('shoppingCount').textContent).toBe('2');
      expect(localStorage.getItem('sessionId')).toBe('thread');
    });

    expect(goGetShoppingList).toHaveBeenCalledWith(mealPlan);
  });

  it('ignores shopping list errors', async () => {
    localStorage.setItem('sessionId', 'thread');
    const checkpoint = new MealPlanningCheckpointState({
      mealPlan: new MealPlan({ items: [new MealPlanItem({ mealType: MealSlot.DINNER, mealSnapshot: new Meal({ id: 1 }) })] }),
    });
    (getAgentCheckpoint as jest.Mock).mockResolvedValue(checkpoint);
    (goGetShoppingList as jest.Mock).mockRejectedValue(new Error('fail'));

    render(<Harness startSessionMock={startSessionMock} />);

    await waitFor(() => {
      expect(screen.getByTestId('hasResume').textContent).toBe('yes');
      expect(screen.getByTestId('shoppingCount').textContent).toBe('0');
    });
  });

  it('abandons existing session before starting new one', async () => {
    localStorage.setItem('sessionId', 'old');
    (getAgentCheckpoint as jest.Mock).mockResolvedValue(undefined);

    render(
      <Harness triggerStart startSessionMock={startSessionMock} />,
    );

    await waitFor(() => {
      expect(postWorkflowsByThreadIdAbandon).toHaveBeenCalledWith({
        client: {},
        path: { threadId: 'old' },
      });
      expect(startSessionMock).toHaveBeenCalled();
    });
  });

  it('exposes startNewSession when no existing session', async () => {
    render(<Harness startSessionMock={startSessionMock} />);

    fireEvent.click(screen.getByTestId('start'));

    await waitFor(() => {
      expect(startSessionMock).toHaveBeenCalled();
    });
  });
});
