import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { DatabaseConnectionError } from './DatabaseConnectionError';
import theme from '../theme';
import '@testing-library/jest-dom';

describe('DatabaseConnectionError Component', () => {
  beforeEach(() => {
    // Use real timers for proper async behavior
    jest.useRealTimers();
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders the error message and retry button', () => {
    const mockRetry = jest.fn().mockResolvedValue(undefined);

    render(
      <ThemeProvider theme={theme}>
        <DatabaseConnectionError onRetry={mockRetry} />
      </ThemeProvider>,
    );

    // Check if the main elements are rendered
    expect(screen.getByText('Database Connection Error')).toBeInTheDocument();
    expect(
      screen.getByText('Unable to connect to the database'),
    ).toBeInTheDocument();
    expect(screen.getByText('Retry Connection')).toBeInTheDocument();
  });

  test('shows loading state when retry button is clicked', async () => {
    const mockRetry = jest.fn().mockResolvedValue(undefined);

    render(
      <ThemeProvider theme={theme}>
        <DatabaseConnectionError onRetry={mockRetry} />
      </ThemeProvider>,
    );

    const retryButton = screen.getByText('Retry Connection');
    fireEvent.click(retryButton);

    // Check if loading state is displayed
    expect(screen.getByText('Attempting to Reconnect...')).toBeInTheDocument();
    expect(retryButton).toBeDisabled();
  });

  test('handles retry function errors gracefully', async () => {
    const mockRetry = jest.fn().mockRejectedValue(new Error('Connection failed'));

    render(
      <ThemeProvider theme={theme}>
        <DatabaseConnectionError onRetry={mockRetry} />
      </ThemeProvider>,
    );

    const retryButton = screen.getByText('Retry Connection');
    fireEvent.click(retryButton);

    // Wait for the retry to complete
    await waitFor(() => {
      expect(mockRetry).toHaveBeenCalled();
    });

    // Verify the error was logged
    expect(console.debug).toHaveBeenCalledWith('Database retry attempt failed:', expect.any(Error));
  });

  test('retry button becomes enabled after loading completes', async () => {
    jest.useFakeTimers();
    const mockRetry = jest.fn().mockResolvedValue(undefined);

    render(
      <ThemeProvider theme={theme}>
        <DatabaseConnectionError onRetry={mockRetry} />
      </ThemeProvider>,
    );

    const retryButton = screen.getByText('Retry Connection');
    fireEvent.click(retryButton);

    // Should be in loading state
    expect(screen.getByText('Attempting to Reconnect...')).toBeInTheDocument();
    expect(retryButton).toBeDisabled();

    // Fast forward timers to complete the minimum loading duration
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText('Retry Connection')).toBeEnabled();
    });

    jest.useRealTimers();
  });

  test('displays troubleshooting steps', () => {
    const mockRetry = jest.fn().mockResolvedValue(undefined);

    render(
      <ThemeProvider theme={theme}>
        <DatabaseConnectionError onRetry={mockRetry} />
      </ThemeProvider>,
    );

    // Check that troubleshooting steps are displayed
    expect(screen.getByText('Troubleshooting steps:')).toBeInTheDocument();
    expect(
      screen.getByText('Make sure Docker is running on your system'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Check if the PostgreSQL database container is started:'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('If not running, start it with:'),
    ).toBeInTheDocument();
  });

  test('retry button can be clicked multiple times', async () => {
    jest.useFakeTimers();
    const mockRetry = jest.fn().mockResolvedValue(undefined);

    render(
      <ThemeProvider theme={theme}>
        <DatabaseConnectionError onRetry={mockRetry} />
      </ThemeProvider>,
    );

    const retryButton = screen.getByText('Retry Connection');

    // First click
    fireEvent.click(retryButton);
    expect(mockRetry).toHaveBeenCalledTimes(1);

    // Fast forward timers to complete the minimum loading duration
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText('Retry Connection')).toBeEnabled();
    });

    // Second click
    fireEvent.click(retryButton);
    expect(mockRetry).toHaveBeenCalledTimes(2);

    // Fast forward timers again
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Wait for loading to complete again
    await waitFor(() => {
      expect(screen.getByText('Retry Connection')).toBeEnabled();
    });

    jest.useRealTimers();
  });
});
