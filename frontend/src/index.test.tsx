// Removed: index.test.tsx is no longer relevant since /agent is the only frontend view.
import { createRoot } from 'react-dom/client';
import App from './App';
import { setupFetchMocks, cleanupFetchMocks } from './test-utils';

// Mock createRoot function
const mockRender = jest.fn();
const mockUnmount = jest.fn();
var mockCreateRoot = jest.fn(() => ({
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
        StrictMode: ({ children }: { children: React.ReactNode }) => children,
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
        setupFetchMocks();
    });

    afterEach(() => {
        // Cleanup
        mockGetElementById.mockRestore();
        consoleError.mockRestore();
        if (document.body.contains(div)) {
            document.body.removeChild(div);
        }
        Object.defineProperty(window, 'location', { value: new URL('http://localhost/'), writable: true });
        cleanupFetchMocks();
    });

    it('renders app component inside create root', () => {
        // Mock document.getElementById to return a div
        mockGetElementById.mockReturnValue(document.createElement('div'));

        // Require index.tsx
        require('./index');

        // Verify createRoot was called
        expect(mockCreateRoot).toHaveBeenCalled();

        // Extract the render call
        const renderCall = mockRender.mock.calls[0][0];
        expect(renderCall.type.name).toBe('StrictMode');

        // Verify it contains ThemeProvider with App component inside
        const themeProvider = renderCall.props.children;
        expect(themeProvider.type.name).toBe('ThemeProvider');

        // Verify App is inside ThemeProvider (after CssBaseline)
        const cssBaseline = themeProvider.props.children[0];
        const app = themeProvider.props.children[1];
        expect(cssBaseline.type.name).toBe('CssBaseline');
        expect(app.type.name).toBe('AgentPage');
    });

    it('renders agent page when path starts with /agent', () => {
        mockGetElementById.mockReturnValue(document.createElement('div'));
        Object.defineProperty(window, 'location', { value: new URL('http://localhost/agent'), writable: true });

        require('./index');

        const renderCall = mockRender.mock.calls[0][0];
        const themeProvider = renderCall.props.children;
        const page = themeProvider.props.children[1];
        expect(page.type.name).toBe('AgentPage');
    });

    it('handles missing root element gracefully', () => {
        // Mock getElementById to return null
        mockGetElementById.mockReturnValue(null);

        // Require index.tsx
        require('./index');

        // Verify createRoot was not called
        expect(mockCreateRoot).not.toHaveBeenCalled();

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