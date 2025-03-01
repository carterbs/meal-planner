import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DatabaseConnectionError } from './DatabaseConnectionError';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material';

// Create a theme for testing
const theme = createTheme();

describe('DatabaseConnectionError Component', () => {
    beforeEach(() => {
        // Mock timers for consistent testing of loading states
        jest.useFakeTimers();
    });

    afterEach(() => {
        // Clear all mocks and restore timers
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    test('renders the error message and retry button', () => {
        const mockRetry = jest.fn().mockResolvedValue(undefined);

        render(
            <ThemeProvider theme={theme}>
                <DatabaseConnectionError onRetry={mockRetry} />
            </ThemeProvider>
        );

        // Check that key elements are rendered
        expect(screen.getByText('Database Connection Error')).toBeInTheDocument();
        expect(screen.getByText('Unable to connect to the database')).toBeInTheDocument();
        expect(screen.getByText('Troubleshooting steps:')).toBeInTheDocument();
        expect(screen.getByText('Retry Connection')).toBeInTheDocument();
    });

    test('shows loading state when retry button is clicked', async () => {
        // Create a mock function that resolves immediately
        const mockRetry = jest.fn().mockResolvedValue(undefined);

        render(
            <ThemeProvider theme={theme}>
                <DatabaseConnectionError onRetry={mockRetry} />
            </ThemeProvider>
        );

        // Click the retry button
        const retryButton = screen.getByText('Retry Connection');
        fireEvent.click(retryButton);

        // Check that loading state is shown
        expect(screen.getByText('Attempting to Reconnect...')).toBeInTheDocument();
        expect(retryButton).toBeDisabled();

        // Verify retry was called
        expect(mockRetry).toHaveBeenCalledTimes(1);

        // Even though the mock resolves immediately, the component will maintain
        // the loading state for the minimum duration
        expect(screen.queryByText('Retry Connection')).not.toBeInTheDocument();

        // Fast-forward time to account for the minimum loading duration
        act(() => {
            jest.advanceTimersByTime(1000);
        });

        // Now the button should be back to its original state
        await waitFor(() => {
            expect(screen.getByText('Retry Connection')).toBeInTheDocument();
            expect(screen.queryByText('Attempting to Reconnect...')).not.toBeInTheDocument();
        });
    });

    test('handles retry function errors gracefully', async () => {
        // Create a mock function that rejects
        const mockRetry = jest.fn(() => Promise.reject(new Error('Connection failed')));

        // Spy on console.error to prevent the error from appearing in test output
        jest.spyOn(console, 'error').mockImplementation(() => { });

        render(
            <ThemeProvider theme={theme}>
                <DatabaseConnectionError onRetry={mockRetry} />
            </ThemeProvider>
        );

        // Click the retry button
        fireEvent.click(screen.getByText('Retry Connection'));

        // Loading state should be active even after rejection
        expect(screen.getByText('Attempting to Reconnect...')).toBeInTheDocument();

        // Fast-forward time to account for the minimum loading duration
        act(() => {
            jest.advanceTimersByTime(1000);
        });

        // Wait for the retry function to complete and error handling to finish
        await waitFor(() => {
            expect(mockRetry).toHaveBeenCalledTimes(1);
            expect(screen.getByText('Retry Connection')).toBeInTheDocument();
            expect(screen.queryByText('Attempting to Reconnect...')).not.toBeInTheDocument();
        });

        // Error should have been logged
        expect(console.error).toHaveBeenCalled();

        // Restore console.error
        (console.error as jest.Mock).mockRestore();
    });

    test('prevents multiple clicks while retrying', async () => {
        // Create a mock function that takes time to resolve
        let resolvePromise: () => void;
        const retryPromise = new Promise<void>(resolve => {
            resolvePromise = resolve;
        });
        const mockRetry = jest.fn(() => retryPromise);

        render(
            <ThemeProvider theme={theme}>
                <DatabaseConnectionError onRetry={mockRetry} />
            </ThemeProvider>
        );

        // Click the retry button
        const retryButton = screen.getByText('Retry Connection');
        fireEvent.click(retryButton);

        // Try clicking it again
        fireEvent.click(retryButton);
        fireEvent.click(retryButton);

        // The function should only have been called once
        expect(mockRetry).toHaveBeenCalledTimes(1);

        // Resolve the promise
        resolvePromise!();

        // Fast-forward time to account for the minimum loading duration
        act(() => {
            jest.advanceTimersByTime(1000);
        });

        // Wait for the retry to complete
        await waitFor(() => {
            expect(screen.getByText('Retry Connection')).toBeInTheDocument();
        });
    });
}); 