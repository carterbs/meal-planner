import React from 'react';
import { render, screen, act } from '@testing-library/react';
import App from './App';

jest.useFakeTimers();

jest.mock('@mealplanner/generated/gateway/client/index.js', () => ({
  createClient: jest.fn(() => ({})),
  createConfig: jest.fn(() => ({})),
}));

jest.mock('@mealplanner/generated/gateway/sdk.gen', () => ({
  getHealth: jest.fn(),
}));

import { getHealth } from '@mealplanner/generated/gateway/sdk.gen';

describe('App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders AgentPage when healthy (default after try)', async () => {
    // cause call to fall through to success true path (no error)
    (getHealth as jest.Mock).mockResolvedValue({});
    render(<App />);

    // initial call
    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    // Should render AgentPage since healthy becomes true
    expect(screen.queryByText('Connecting to server...')).toBeNull();
  });

  it('renders Connecting with services when error includes services, and stops polling when healthy', async () => {
    let calls = 0;
    (getHealth as jest.Mock).mockImplementation(() => {
      calls += 1;
      if (calls === 1) {
        return Promise.resolve({
          error: { services: { api: true, agent: false } },
        });
      }
      return Promise.resolve({});
    });

    render(<App />);

    // first poll: show Connecting with services
    await act(async () => {
      // allow initial health check to resolve with error
      await Promise.resolve();
    });
    // Connecting renders immediately on mount when healthy=false, checking=true
    expect(screen.getByText('Connecting to server...')).toBeInTheDocument();
    expect(screen.getByText('api: healthy')).toBeInTheDocument();
    expect(screen.getByText('agent: unhealthy')).toBeInTheDocument();

    // next poll: becomes healthy and polling stops
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    expect(screen.queryByText('Connecting to server...')).toBeNull();
  });

  it('ignores getHealth exceptions and treats as healthy', async () => {
    (getHealth as jest.Mock).mockRejectedValue(new Error('net down'));
    render(<App />);

    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    expect(screen.queryByText('Connecting to server...')).toBeNull();
  });

  it('clears interval after initial error shows all services healthy (ok=true path inside error branch)', async () => {
    const clearSpy = jest.spyOn(global, 'clearInterval');
    (getHealth as jest.Mock).mockResolvedValue({
      error: { services: { api: true, agent: true } },
    });

    render(<App />);

    // Allow initial health check to resolve with error branch, ok=true
    await act(async () => {
      await Promise.resolve();
    });
    // After ok=true, app becomes healthy immediately
    expect(screen.queryByText('Connecting to server...')).toBeNull();

    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    // Interval should have been cleared
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('clears interval on unmount via cleanup when still unhealthy', async () => {
    const clearSpy = jest.spyOn(global, 'clearInterval');
    (getHealth as jest.Mock).mockResolvedValue({
      error: { services: { api: false } },
    });

    const { unmount } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    // Unmount before becoming healthy; cleanup should clear interval
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
