import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';
import '@testing-library/jest-dom';

import { getHealth } from '@mealplanner/generated/dist/gateway/sdk.gen';

jest.mock('@mealplanner/generated/dist/gateway/client/index.js', () => ({
  createClient: jest.fn(() => ({})),
  createConfig: jest.fn(() => ({})),
}));

jest.mock('@mealplanner/generated/dist/gateway/sdk.gen', () => ({
  getHealth: jest.fn(),
  postReconnect: jest.fn(),
}));

afterEach(() => {
  jest.resetAllMocks();
});

test('renders AgentPage when backend is healthy', async () => {
  (getHealth as jest.Mock).mockResolvedValue({
    data: { status: 'ok', services: { backend: true } },
    error: undefined,
  });

  render(<App />);

  await screen.findByTestId('start-session');
});

test('shows connecting view when health check fails', async () => {
  (getHealth as jest.Mock).mockRejectedValue(new Error('fail'));

  render(<App />);

  await screen.findByText('Connecting to server...');
});
