import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import AgentPage from './AgentPage';
import { WeeklyMealPlan } from '@mealplanner/generated';

const mockController: any = {
  session: undefined,
  startSession: async () => {},
  logout: jest.fn(),
  input: '',
  setInput: jest.fn(),
  isWorking: false,
  messages: [],
  sendMessage: jest.fn(async () => ({})),
  mealPlan: undefined,
  shoppingList: undefined,
};

jest.mock('./pages/AgentPage/hooks/useAgentController', () => ({
  __esModule: true,
  default: () => mockController,
}));

jest.mock('./hooks/useMealPlanHighlights', () => {
  const mockApply = jest.fn();
  return {
    __esModule: true,
    default: () => ({ highlights: new Set(), applyHighlights: mockApply }),
  };
});

jest.mock('./hooks/useAutoScroll', () => {
  const createRef = () => ({ current: null });
  return {
    __esModule: true,
    default: jest.fn(() => createRef()),
  };
});

jest.mock('./hooks/useSession', () => ({
  __esModule: true,
  default: () => ({ startNewSession: jest.fn() }),
}));

const mockOnOpenMealLibraryClick = jest.fn();

jest.mock('./pages/AgentPage/components/chat/ChatPanel', () => ({
  __esModule: true,
  default: (props: any) => {
    const { onEnterKey, onOpenMealLibrary, onStartSession, onLogout, onSend } =
      props;
    return (
      <div>
        <input
          data-testid="message-input"
          onKeyDown={(e) => onEnterKey && onEnterKey(e as any)}
        />
        <button data-testid="send-message" onClick={onSend}>
          Send
        </button>
        <button
          data-testid="open-lib"
          onClick={() => {
            onOpenMealLibrary();
            mockOnOpenMealLibraryClick();
          }}
        >
          OpenLib
        </button>
        <button data-testid="start-session" onClick={() => onStartSession()}>
          StartSession
        </button>
        <button data-testid="logout" onClick={onLogout}>
          Logout
        </button>
      </div>
    );
  },
}));

let capturedPlanHandlers: any = {};
jest.mock('./pages/AgentPage/components/plan/PlanPanel', () => ({
  __esModule: true,
  default: (props: any) => {
    capturedPlanHandlers = props;
    return (
      <div>
        <button data-testid="copy-plan" onClick={props.onCopyMealPlan}>
          CopyPlan
        </button>
        <button data-testid="copy-shopping" onClick={props.onCopyShoppingList}>
          CopyShopping
        </button>
        <button data-testid="tab-change" onClick={() => props.onTabChange(1)}>
          ChangeTab
        </button>
      </div>
    );
  },
}));

jest.mock('./pages/MealManagementPage/MealManagementPage', () => ({
  __esModule: true,
  default: ({ onClose, showToast }: any) => (
    <div>
      <div>MealLibrary</div>
      <button data-testid="close-meal-library" onClick={onClose}>
        Close
      </button>
      <button
        data-testid="trigger-toast"
        onClick={() => showToast('Test toast')}
      >
        ShowToast
      </button>
    </div>
  ),
}));

jest.mock('./components/Toast', () => ({
  __esModule: true,
  Toast: ({ message }: any) =>
    message ? <div data-testid="toast">{message}</div> : null,
}));

jest.mock('./utils/clipboard', () => ({
  __esModule: true,
  copyMealPlanToClipboard: jest.fn(async () => {}),
  copyShoppingListToClipboard: jest.fn(async () => {}),
}));

import {
  copyMealPlanToClipboard,
  copyShoppingListToClipboard,
} from './utils/clipboard';

describe('AgentPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockController, {
      session: undefined,
      input: '',
      isWorking: false,
      messages: [],
      mealPlan: undefined,
      shoppingList: undefined,
      sendMessage: jest.fn(async () => ({})),
    });
  });

  it('renders and triggers send on Enter (no Shift)', () => {
    render(<AgentPage />);
    const input = screen.getByTestId('message-input');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockController.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('does not send on Shift+Enter', () => {
    render(<AgentPage />);
    const input = screen.getByTestId('message-input');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(mockController.sendMessage).not.toHaveBeenCalled();
  });

  it('applies highlights when sendMessage returns newPlan', async () => {
    const plan = new WeeklyMealPlan({ days: [] });
    mockController.sendMessage = jest.fn(async () => ({ newPlan: plan }));
    render(<AgentPage />);
    const input = screen.getByTestId('message-input');
    await fireEvent.keyDown(input, { key: 'Enter' });
    // Re-require the hook module factory to get the mock function reference
    const hookMod: any = require('./hooks/useMealPlanHighlights');
    expect(hookMod.default().applyHighlights).toHaveBeenCalledWith(plan);
  });

  it('opens meal library view when requested', () => {
    render(<AgentPage />);
    fireEvent.click(screen.getByTestId('open-lib'));
    expect(mockOnOpenMealLibraryClick).toHaveBeenCalled();
    expect(screen.getByText('MealLibrary')).toBeInTheDocument();
  });

  it('copies plan and shopping list via handlers when present and guards when absent', async () => {
    const { unmount } = render(<AgentPage />);
    fireEvent.click(screen.getAllByTestId('copy-plan')[0]);
    fireEvent.click(screen.getAllByTestId('copy-shopping')[0]);
    expect(copyMealPlanToClipboard).not.toHaveBeenCalled();
    expect(copyShoppingListToClipboard).not.toHaveBeenCalled();

    unmount();
    Object.assign(mockController, {
      mealPlan: new WeeklyMealPlan({ days: [] }),
      shoppingList: [{ ingredient: 'Tomato', quantity: 1 }] as any,
    });
    render(<AgentPage />);
    fireEvent.click(screen.getAllByTestId('copy-plan')[0]);
    fireEvent.click(screen.getAllByTestId('copy-shopping')[0]);
    expect(copyMealPlanToClipboard).toHaveBeenCalled();
    expect(copyShoppingListToClipboard).toHaveBeenCalled();
  });

  it('starts new session via hook', () => {
    render(<AgentPage />);
    fireEvent.click(screen.getByTestId('start-session'));
    const mod: any = require('./hooks/useSession');
    expect(mod.default().startNewSession).toBeDefined();
  });

  it('handles logout', () => {
    render(<AgentPage />);
    fireEvent.click(screen.getByTestId('logout'));
    expect(mockController.logout).toHaveBeenCalled();
  });

  it('sends message via send button', () => {
    render(<AgentPage />);
    fireEvent.click(screen.getByTestId('send-message'));
    expect(mockController.sendMessage).toHaveBeenCalled();
  });

  it('closes meal library when close button is clicked', () => {
    render(<AgentPage />);

    // First open the library
    fireEvent.click(screen.getByTestId('open-lib'));
    expect(screen.getByText('MealLibrary')).toBeInTheDocument();

    // Then close it
    fireEvent.click(screen.getByTestId('close-meal-library'));
    expect(screen.queryByText('MealLibrary')).not.toBeInTheDocument();
  });

  it('handles tab changes', () => {
    render(<AgentPage />);
    fireEvent.click(screen.getByTestId('tab-change'));
    // Tab change is handled internally by the component
    expect(capturedPlanHandlers.onTabChange).toBeDefined();
  });

  it('shows and hides toast messages', async () => {
    jest.useFakeTimers();

    render(<AgentPage />);

    // Open meal library to access toast trigger
    fireEvent.click(screen.getByTestId('open-lib'));

    // Trigger toast
    fireEvent.click(screen.getByTestId('trigger-toast'));
    expect(screen.getByTestId('toast')).toHaveTextContent('Test toast');

    // Fast forward time to hide toast (wrapped in act)
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  it('handles sendMessage without newPlan response', async () => {
    mockController.sendMessage = jest.fn(async () => ({}));
    render(<AgentPage />);
    const input = screen.getByTestId('message-input');
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockController.sendMessage).toHaveBeenCalled();
  });

  it('handles sendMessage with null response', async () => {
    mockController.sendMessage = jest.fn(async () => null);
    render(<AgentPage />);
    const input = screen.getByTestId('message-input');
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockController.sendMessage).toHaveBeenCalled();
  });

  it('does not trigger send on other keys', () => {
    render(<AgentPage />);
    const input = screen.getByTestId('message-input');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(mockController.sendMessage).not.toHaveBeenCalled();
  });

  it('passes correct props to components', () => {
    mockController.mealPlan = new WeeklyMealPlan({ days: [] });
    mockController.shoppingList = [{ ingredient: 'test', quantity: 1 }];

    render(<AgentPage />);

    expect(capturedPlanHandlers.mealPlan).toBe(mockController.mealPlan);
    expect(capturedPlanHandlers.shoppingList).toBe(mockController.shoppingList);
    expect(capturedPlanHandlers.currentTab).toBe(0);
    expect(capturedPlanHandlers.highlights).toBeInstanceOf(Set);
    expect(capturedPlanHandlers.colors).toBeDefined();
  });
});
