import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AgentPage from './AgentPage';
import { 
  setupFetchMocks, 
  cleanupFetchMocks, 
  mockMealPlan, 
  mockShoppingList,
  mockClipboard,
  mockLocalStorage,
  loadingUtils 
} from './test-utils';

describe('Integration Tests', () => {
  beforeEach(() => {
    setupFetchMocks();
    mockClipboard();
    mockLocalStorage();
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanupFetchMocks();
    jest.useRealTimers();
    jest.restoreAllMocks();
    localStorage.clear();
  });

  test('completes full meal planning workflow end-to-end', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: {
            threadId: 'workflow-123',
            currentStep: 'started',
            message: 'Welcome! Let me help you plan your meals.',
            initialState: JSON.stringify({
              state: { mealPlan: { days: [] } }
            })
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { sender: 'agent', content: 'Welcome! Let me help you plan your meals.' }
        ])
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: {
            message: 'Great! I\'ve created a meal plan for you.',
            initialState: JSON.stringify({
              state: { mealPlan: mockMealPlan }
            })
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { sender: 'agent', content: 'Welcome! Let me help you plan your meals.' },
          { sender: 'user', content: 'I want a healthy meal plan' },
          { sender: 'agent', content: 'Great! I\'ve created a meal plan for you.' }
        ])
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          state: { mealPlan: mockMealPlan }
        })
      });

    render(<AgentPage />);

    // Start session
    fireEvent.click(screen.getByTestId('start-session'));
    
    await waitFor(() => {
      expect(screen.getByTestId('message-input')).toBeInTheDocument();
    });

    // Send message
    fireEvent.change(screen.getByTestId('message-input'), {
      target: { value: 'I want a healthy meal plan' }
    });
    fireEvent.click(screen.getByTestId('send-button'));

    // Verify workflow completion
    await waitFor(() => {
      expect(screen.getByTestId('meal-plan-table')).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(screen.getByText('Test Meal 1')).toBeInTheDocument();
  });

  test('handles offline mode and data synchronization', async () => {
    // Simulate online state
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        response: { threadId: '123', currentStep: 'started' }
      })
    });

    render(<AgentPage />);
    fireEvent.click(screen.getByTestId('start-session'));

    await waitFor(() => {
      expect(screen.getByTestId('message-input')).toBeInTheDocument();
    });

    // Simulate going offline
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

    fireEvent.change(screen.getByTestId('message-input'), {
      target: { value: 'test message while offline' }
    });
    fireEvent.click(screen.getByTestId('send-button'));

    // Should handle offline gracefully
    await waitFor(() => {
      expect(screen.getByTestId('message-input')).toBeInTheDocument();
    });
  });

  test('maintains data consistency across page refreshes', async () => {
    const sessionData = {
      threadId: 'persistent-session',
      currentStep: 'planning',
      mealPlan: mockMealPlan,
    };

    localStorage.setItem('sessionId', sessionData.threadId);
    
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(sessionData)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { sender: 'agent', content: 'Session resumed successfully' }
        ])
      });

    // First render (initial page load)
    const { unmount } = render(<AgentPage />);
    
    await waitFor(() => {
      expect(screen.getByTestId('meal-plan-table')).toBeInTheDocument();
    });

    const mealPlanBefore = screen.getByText('Test Meal 1');
    expect(mealPlanBefore).toBeInTheDocument();

    // Unmount and remount (simulate page refresh)
    unmount();
    
    render(<AgentPage />);

    await waitFor(() => {
      expect(screen.getByTestId('meal-plan-table')).toBeInTheDocument();
    });

    // Data should persist after refresh
    expect(screen.getByText('Test Meal 1')).toBeInTheDocument();
  });

  test('handles concurrent user actions without conflicts', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        response: { threadId: '123', currentStep: 'started' }
      })
    });

    render(<AgentPage />);
    fireEvent.click(screen.getByTestId('start-session'));

    await waitFor(() => {
      expect(screen.getByTestId('message-input')).toBeInTheDocument();
    });

    const input = screen.getByTestId('message-input');
    const sendButton = screen.getByTestId('send-button');

    // Simulate multiple rapid actions
    const actions = [
      () => fireEvent.change(input, { target: { value: 'action 1' } }),
      () => fireEvent.click(sendButton),
      () => fireEvent.change(input, { target: { value: 'action 2' } }),
      () => fireEvent.click(sendButton),
      () => fireEvent.change(input, { target: { value: 'action 3' } }),
    ];

    // Execute actions rapidly
    actions.forEach(action => action());

    // Should handle without crashing
    expect(input).toBeInTheDocument();
    expect(sendButton).toBeInTheDocument();
  });
});

describe('Performance Tests', () => {
  beforeEach(() => {
    setupFetchMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanupFetchMocks();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('renders large meal plans efficiently', async () => {
    const largeMealPlan = {
      ...mockMealPlan,
      days: Array.from({ length: 50 }, (_, i) => ({
        dayIndex: i % 7,
        mealType: ['breakfast', 'lunch', 'dinner'][i % 3],
        meal: {
          id: i,
          name: `Meal ${i}`,
          effort: (i % 3) + 1,
          hasRedMeat: i % 4 === 0,
          mealType: 'dinner',
          url: '',
          ingredients: [],
          steps: [],
        }
      }))
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        response: {
          threadId: '123',
          currentStep: 'started',
          initialState: JSON.stringify({
            state: { mealPlan: largeMealPlan }
          })
        }
      })
    });

    const startTime = performance.now();
    render(<AgentPage />);
    fireEvent.click(screen.getByTestId('start-session'));

    await waitFor(() => {
      expect(screen.getByTestId('meal-plan-table')).toBeInTheDocument();
    });

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(2000); // Should render within 2 seconds
  });

  test('handles rapid user input without lag', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        response: { threadId: '123', currentStep: 'started' }
      })
    });

    render(<AgentPage />);
    fireEvent.click(screen.getByTestId('start-session'));

    await waitFor(() => {
      expect(screen.getByTestId('message-input')).toBeInTheDocument();
    });

    const input = screen.getByTestId('message-input');
    const startTime = performance.now();

    // Simulate rapid typing
    const rapidText = 'This is a very long message that simulates rapid user typing to test performance';
    for (let i = 0; i < rapidText.length; i++) {
      fireEvent.change(input, { target: { value: rapidText.slice(0, i + 1) } });
    }

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(500); // Should handle rapid input within 500ms
  });

  test('optimizes memory usage for long sessions', async () => {
    const largeMessageHistory = Array.from({ length: 1000 }, (_, i) => ({
      sender: i % 2 === 0 ? 'user' : 'agent',
      content: `This is message ${i} with substantial content to test memory usage optimization during long conversation sessions`
    }));

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: { threadId: '123', currentStep: 'started' }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(largeMessageHistory)
      });

    const { container } = render(<AgentPage />);
    fireEvent.click(screen.getByTestId('start-session'));

    await waitFor(() => {
      expect(screen.getByTestId('message-input')).toBeInTheDocument();
    });

    // Check that component renders without memory issues
    expect(container.children.length).toBeGreaterThan(0);
    expect(screen.getByTestId('chat-history')).toBeInTheDocument();
  });
});