import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Mock createRoot function
const mockRender = jest.fn();
const mockUnmount = jest.fn();
const mockCreateRoot = jest.fn(() => ({
    render: mockRender,
    unmount: mockUnmount
}));

jest.mock('react-dom/client', () => ({
    createRoot: mockCreateRoot
}));

// Mock React.StrictMode
jest.mock('react', () => {
    const originalModule = jest.requireActual('react');
    return {
        ...originalModule,
        StrictMode: ({ children }: { children: React.ReactNode }) => children
    };
});

describe('index.tsx', () => {
    let div: HTMLDivElement;
    let mockGetElementById: jest.SpyInstance;
    let consoleError: jest.SpyInstance;

    beforeEach(() => {
        // Clear all mocks
        mockRender.mockClear();
        mockUnmount.mockClear();
        mockCreateRoot.mockClear();

        // Reset mock implementations
        mockCreateRoot.mockImplementation(() => ({
            render: mockRender,
            unmount: mockUnmount
        }));

        // Create a div to serve as root
        div = document.createElement('div');
        div.id = 'root';
        document.body.appendChild(div);

        // Mock getElementById
        mockGetElementById = jest.spyOn(document, 'getElementById');

        // Mock console.error
        consoleError = jest.spyOn(console, 'error').mockImplementation(() => { });

        // Clear module cache before each test
        jest.resetModules();
    });

    afterEach(() => {
        // Cleanup
        mockGetElementById.mockRestore();
        consoleError.mockRestore();
        if (document.body.contains(div)) {
            document.body.removeChild(div);
        }
    });

    it('renders without crashing', () => {
        // Mock getElementById to return the div
        mockGetElementById.mockReturnValue(div);

        // Require index.tsx
        require('./index');

        // Verify createRoot was called with the root element
        expect(mockCreateRoot).toHaveBeenCalledWith(div);

        // Verify render was called
        expect(mockRender).toHaveBeenCalled();

        // Get the rendered element
        const renderCall = mockRender.mock.calls[0][0];

        // Verify it's a StrictMode component
        expect(renderCall.type.name).toBe('StrictMode');

        // Verify it contains an App component
        const app = renderCall.props.children;
        expect(app.type.name).toBe('App');
    });

    it('handles missing root element gracefully', () => {
        // Mock getElementById to return null
        mockGetElementById.mockReturnValue(null);

        // Require index.tsx
        require('./index');

        // Verify createRoot was not called
        expect(mockCreateRoot).not.toHaveBeenCalled();

        // Verify render was not called
        expect(mockRender).not.toHaveBeenCalled();

        // Verify error was logged
        expect(consoleError).toHaveBeenCalledWith('Root element not found');
    });

    it('handles createRoot errors gracefully', () => {
        // Mock getElementById to return the div
        mockGetElementById.mockReturnValue(div);

        // Mock createRoot to throw an error
        mockCreateRoot.mockImplementationOnce(() => {
            throw new Error('Failed to create root');
        });

        // Require index.tsx
        require('./index');

        // Verify error was logged
        expect(consoleError).toHaveBeenCalledWith('Failed to create root');
    });

    it('handles non-Error errors gracefully', () => {
        // Mock getElementById to return the div
        mockGetElementById.mockReturnValue(div);

        // Mock createRoot to throw a non-Error value
        mockCreateRoot.mockImplementationOnce(() => {
            throw 'Some string error';
        });

        // Require index.tsx
        require('./index');

        // Verify error was logged with default message
        expect(consoleError).toHaveBeenCalledWith('Failed to initialize app');
    });
}); 