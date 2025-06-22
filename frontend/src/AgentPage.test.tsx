import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AgentPage from './AgentPage';

beforeEach(() => {
  (global.fetch as jest.Mock) = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
});

test('copies meal plan to clipboard', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    json: () => Promise.resolve({
      threadId: '123',
      currentStep: 'started',
      message: 'hi',
      initialState: { meal_plan: { days: [ { dayIndex: 0, mealType: 'breakfast', meal: { id: 1, name: 'Eggs', effort: 1 } } ] } }
    })
  });

  const write = jest.fn();
  Object.assign(navigator, { clipboard: { write, writeText: write } });
  // Mock ClipboardItem constructor
  (global as any).ClipboardItem = jest.fn().mockImplementation(data => ({ data }));

  render(<AgentPage />);
  fireEvent.click(screen.getByTestId('start-session'));

  await waitFor(() => expect(screen.getByTestId('meal-plan-table')).toBeInTheDocument());

  fireEvent.click(screen.getByTestId('copy-meal-plan'));
  expect(write).toHaveBeenCalled();
});

test('copies shopping list to clipboard', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    json: () => Promise.resolve({
      threadId: '123',
      currentStep: 'started',
      message: 'hi',
      raw: { meal_plan: { days: [] }, shopping_list_formatted: '- eggs\n' }
    })
  });

  const writeText = jest.fn();
  Object.assign(navigator, { clipboard: { writeText } });

  render(<AgentPage />);
  fireEvent.click(screen.getByTestId('start-session'));

  await waitFor(() => expect(screen.getByTestId('copy-shopping-list')).toBeInTheDocument());

  fireEvent.click(screen.getByTestId('copy-shopping-list'));
  expect(writeText).toHaveBeenCalledWith('- eggs\n');
});

test('starts a new session', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    json: () => Promise.resolve({
      threadId: '123',
      currentStep: 'started',
      message: 'hi',
      initialState: { meal_plan: { days: [ { dayIndex: 0, mealType: 'breakfast', meal: { id: 1, name: 'Eggs', effort: 1 } } ] } }
    })
  });
  render(<AgentPage />);
  fireEvent.click(screen.getByTestId('start-session'));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith('/api/agent/start', expect.any(Object));
    expect(screen.getByTestId('session-id')).toHaveTextContent('123');
    expect(screen.getByTestId('meal-plan-table')).toBeInTheDocument();
  });
});

test('sends a message in an existing session', async () => {
  // start session response
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    json: () => Promise.resolve({ threadId: '123', currentStep: 'started' })
  });
  render(<AgentPage />);
  fireEvent.click(screen.getByTestId('start-session'));
  await waitFor(() => expect(screen.getByTestId('message-input')).toBeInTheDocument());

  // feedback response
  (global.fetch as jest.Mock).mockResolvedValueOnce({ json: () => Promise.resolve({}) });
  // resume response
  (global.fetch as jest.Mock).mockResolvedValueOnce({ json: () => Promise.resolve({ message: 'ok', raw: { meal_plan: { days: [] } } }) });

  fireEvent.change(screen.getByTestId('message-input'), { target: { value: 'hello' } });
  fireEvent.click(screen.getByTestId('send-button'));

  await waitFor(() => {
    const feedbackCall = (global.fetch as jest.Mock).mock.calls.find(c => c[0] === '/api/agent/feedback');
    const resumeCall = (global.fetch as jest.Mock).mock.calls.find(c => c[0] === '/api/agent/resume');
    expect(feedbackCall).toBeTruthy();
    expect(resumeCall).toBeTruthy();
    if (feedbackCall) {
      expect(JSON.parse(feedbackCall[1].body).threadId).toBe('123');
    }
    if (resumeCall) {
      expect(JSON.parse(resumeCall[1].body).threadId).toBe('123');
    }
    expect(screen.getByText('ok')).toBeInTheDocument();
  });
});

test('pressing Enter sends the message', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({ json: () => Promise.resolve({ threadId: '123', currentStep: 'started' }) });
  render(<AgentPage />);
  fireEvent.click(screen.getByTestId('start-session'));
  await waitFor(() => expect(screen.getByTestId('message-input')).toBeInTheDocument());

  (global.fetch as jest.Mock).mockResolvedValueOnce({ json: () => Promise.resolve({}) });
  (global.fetch as jest.Mock).mockResolvedValueOnce({ json: () => Promise.resolve({ message: 'ok', raw: { meal_plan: { days: [] } } }) });

  fireEvent.change(screen.getByTestId('message-input'), { target: { value: 'hello' } });
  fireEvent.keyPress(screen.getByTestId('message-input'), { key: 'Enter', code: 'Enter', charCode: 13 });

  await waitFor(() => expect(screen.getByText('ok')).toBeInTheDocument());
});

test('highlights changed meal plan entries', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    json: () => Promise.resolve({
      threadId: '123',
      currentStep: 'started',
      initialState: { meal_plan: { days: [ { dayIndex: 0, mealType: 'breakfast', meal: { id: 1, name: 'Eggs', effort: 1 } } ] } }
    })
  });

  render(<AgentPage />);
  fireEvent.click(screen.getByTestId('start-session'));

  await waitFor(() => expect(screen.getByTestId('meal-plan-table')).toBeInTheDocument());

  (global.fetch as jest.Mock).mockResolvedValueOnce({ json: () => Promise.resolve({}) });
  (global.fetch as jest.Mock).mockResolvedValueOnce({ json: () => Promise.resolve({ 
    message: 'ok', 
    meal_plan: { days: [ { dayIndex: 0, mealType: 'breakfast', meal: { id: 2, name: 'Pancakes', effort: 1 } } ] }
  }) });

  fireEvent.change(screen.getByTestId('message-input'), { target: { value: 'change' } });
  fireEvent.click(screen.getByTestId('send-button'));

  await waitFor(() => {
    const mealElement = screen.getByTestId('meal-0-breakfast');
    // Check that the meal name span has the highlight style
    const mealNameSpan = mealElement.querySelector('span');
    expect(mealNameSpan).toHaveStyle({ backgroundColor: '#81c784' });
  }); 
});

test('shows typing indicator when agent is working', async () => {
  let resolvePromise: (value: any) => void;
  const promise = new Promise(resolve => {
    resolvePromise = resolve;
  });
  
  (global.fetch as jest.Mock).mockReturnValueOnce({
    json: () => promise
  });

  render(<AgentPage />);
  fireEvent.click(screen.getByTestId('start-session'));

  // Check that typing indicator appears when working
  await waitFor(() => {
    expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
  });

  // Resolve the promise to complete the request
  resolvePromise!({
    threadId: '123',
    currentStep: 'started',
    message: 'Ready'
  });

  // Wait for typing indicator to disappear
  await waitFor(() => {
    expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument();
  });
});
