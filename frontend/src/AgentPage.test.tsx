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

test('starts a new session', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    json: () => Promise.resolve({ threadId: '123', currentStep: 'started', message: 'hi' })
  });
  render(<AgentPage />);
  fireEvent.click(screen.getByTestId('start-session'));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith('/api/agent/start', expect.any(Object));
    expect(screen.getByTestId('session-id')).toHaveTextContent('123');
  });
});

test('sends a message in an existing session', async () => {
  // start session response
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    json: () => Promise.resolve({ threadId: '123', currentStep: 'started' })
  });
  render(<AgentPage />);
  fireEvent.click(screen.getByTestId('start-session'));
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());

  // feedback response
  (global.fetch as jest.Mock).mockResolvedValueOnce({ json: () => Promise.resolve({}) });
  // resume response
  (global.fetch as jest.Mock).mockResolvedValueOnce({ json: () => Promise.resolve({ message: 'ok' }) });

  fireEvent.change(screen.getByTestId('message-input'), { target: { value: 'hello' } });
  fireEvent.click(screen.getByTestId('send-button'));

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith('/api/agent/feedback', expect.any(Object));
    expect(global.fetch).toHaveBeenCalledWith('/api/agent/resume', expect.any(Object));
    expect(screen.getByText('agent: ok')).toBeInTheDocument();
  });
});
