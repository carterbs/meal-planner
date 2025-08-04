import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import '@testing-library/jest-dom';

jest.mock('@mealplanner/generated/dist/gateway/client/index.js', () => ({
  createClient: jest.fn(() => ({})),
  createConfig: jest.fn(() => ({})),
}));

jest.mock('@mealplanner/generated/dist/gateway/sdk.gen', () => ({
  getHealth: jest.fn(),
}));

import { getHealth } from '@mealplanner/generated/dist/gateway/sdk.gen';

afterEach(() => {
  jest.resetAllMocks();
});

test('renders AgentPage when backend is healthy', async () => {
  (getHealth as jest.Mock).mockResolvedValue({
    data: { status: 'ok', services: { backend: true } },
    error: undefined,
  });

  render(<App />);

  await waitFor(() =>
    expect(screen.getByTestId('start-session')).toBeInTheDocument(),
  );
});

test('shows error page when health check fails', async () => {
  (getHealth as jest.Mock).mockRejectedValue(new Error('fail'));

  render(<App />);

  await waitFor(() =>
    expect(screen.getByText('Database Connection Error')).toBeInTheDocument(),
  );
});
