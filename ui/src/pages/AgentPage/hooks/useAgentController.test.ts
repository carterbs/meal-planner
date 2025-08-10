import { renderHook, act, waitFor } from '@testing-library/react';

// Mock API layer used by the hook (names must start with "mock" for jest.mock factory access)
const mockStartAgentSession = jest.fn().mockResolvedValue({
    session: { threadId: 't1', currentStep: '' },
    message: 'hello',
});
const mockSendAgentMessage = jest.fn().mockResolvedValue({});
const mockGetAgentCheckpoint = jest
    .fn()
    .mockResolvedValue({ state: { mealPlan: { days: [] } } });
const mockGetMessages = jest
    .fn()
    .mockResolvedValue([{ sender: 'agent', content: 'hi' }]);
const mockGoGetShoppingList = jest.fn().mockResolvedValue([]);

jest.mock('../../../api', () => ({
    __esModule: true,
    startAgentSession: (...args: unknown[]) => mockStartAgentSession(...args),
    sendAgentMessage: (...args: unknown[]) => mockSendAgentMessage(...args),
    getAgentCheckpoint: (...args: unknown[]) => mockGetAgentCheckpoint(...args),
    getMessages: (...args: unknown[]) => mockGetMessages(...args),
    goGetShoppingList: (...args: unknown[]) => mockGoGetShoppingList(...args),
}));

// Mock useSession to avoid network
// Provide resume path by default to simplify initialization and avoid startAgentSession mismatch
jest.mock('../../../hooks/useSession', () => ({
    __esModule: true,
    default: () => ({
        isResuming: false,
        resumeData: { threadId: 't1', currentStep: '' },
        startNewSession: jest.fn(),
    }),
}));

// Mock generated types to avoid loading large runtime bundle
jest.mock('@mealplanner/generated', () => ({
    __esModule: true,
    ShoppingListItem: class ShoppingListItem {
        ingredient: string;
        quantity: string;
        category: string;
        constructor(args: {
            ingredient?: string;
            quantity?: string;
            category?: string;
        }) {
            this.ingredient = args.ingredient ?? '';
            this.quantity = args.quantity ?? '';
            this.category = args.category ?? '';
        }
    },
    WeeklyMealPlan: class WeeklyMealPlan { },
}));

// Import after mocks are set up
import useAgentController from './useAgentController';

describe('useAgentController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Initial State and Resume', () => {
        it('hydrates messages on resume and can send', async () => {
            const { result } = renderHook(() => useAgentController());
            // allow effects to run for resume hydration
            await act(async () => {
                await Promise.resolve();
            });
            expect(result.current.session).not.toBeNull();
            await waitFor(() => {
                expect(mockGetMessages).toHaveBeenCalled();
            });

            act(() => {
                result.current.setInput('Hi');
            });

            await act(async () => {
                await result.current.sendMessage();
            });

            expect(mockSendAgentMessage).toHaveBeenCalled();
            expect(result.current.isWorking).toBe(false);
        });

        it('initializes with correct default state', () => {
            const { result } = renderHook(() => useAgentController());

            expect(result.current.input).toBe('');
            expect(result.current.messages).toEqual([]);
            expect(result.current.mealPlan).toBeNull();
            expect(result.current.shoppingList).toBeNull();
            expect(typeof result.current.setInput).toBe('function');
            expect(typeof result.current.sendMessage).toBe('function');
            expect(typeof result.current.startSession).toBe('function');
            expect(typeof result.current.logout).toBe('function');
            expect(typeof result.current.setMealPlanExternal).toBe('function');
        });
    });

    describe('Session Management', () => {
        it('startSession with meal plan in initial state', async () => {
            const mockMealPlan = { days: [{ date: '2023-01-01', meals: [] }] };
            const mockResult = {
                session: { threadId: 'test-thread', currentStep: 'step1' },
                message: 'Welcome message',
                initialState: { mealPlan: mockMealPlan },
            };

            mockStartAgentSession.mockResolvedValueOnce(mockResult);

            const { result } = renderHook(() => useAgentController());

            await act(async () => {
                await result.current.startSession();
            });

            expect(mockStartAgentSession).toHaveBeenCalled();
            expect(mockGetAgentCheckpoint).toHaveBeenCalledWith('test-thread');
            expect(mockGetMessages).toHaveBeenCalledWith('test-thread');
        });

        it('startSession without initial state or message', async () => {
            const mockResult = {
                session: { threadId: 'test-thread', currentStep: 'step1' },
                message: '',
                initialState: null,
            };

            mockStartAgentSession.mockResolvedValueOnce(mockResult);

            const { result } = renderHook(() => useAgentController());

            await act(async () => {
                await result.current.startSession();
            });

            expect(mockStartAgentSession).toHaveBeenCalled();
            expect(mockGetAgentCheckpoint).toHaveBeenCalledWith('test-thread');
            expect(mockGetMessages).toHaveBeenCalledWith('test-thread');
        });

        it('startSession with only message, no meal plan', async () => {
            const mockResult = {
                session: { threadId: 'test-thread', currentStep: 'step1' },
                message: 'Hello there',
                initialState: { someOtherData: 'value' },
            };

            mockStartAgentSession.mockResolvedValueOnce(mockResult);

            const { result } = renderHook(() => useAgentController());

            await act(async () => {
                await result.current.startSession();
            });

            expect(mockStartAgentSession).toHaveBeenCalled();
            expect(mockGetAgentCheckpoint).toHaveBeenCalledWith('test-thread');
            expect(mockGetMessages).toHaveBeenCalledWith('test-thread');
        });

        it('startSession without session threadId', async () => {
            const mockResult = {
                session: { threadId: '', currentStep: 'step1' }, // Empty threadId to avoid null error
                message: 'Error occurred',
                initialState: null,
            };

            mockStartAgentSession.mockResolvedValueOnce(mockResult);

            const { result } = renderHook(() => useAgentController());

            await act(async () => {
                await result.current.startSession();
            });

            expect(mockStartAgentSession).toHaveBeenCalled();
        });

        it('startSession with session but no threadId', async () => {
            const mockResult = {
                session: { threadId: null, currentStep: 'step1' }, // null threadId
                message: 'Partial session',
                initialState: null,
            };

            mockStartAgentSession.mockResolvedValueOnce(mockResult);

            const { result } = renderHook(() => useAgentController());

            await act(async () => {
                await result.current.startSession();
            });

            expect(mockStartAgentSession).toHaveBeenCalled();
        });

        it('logout clears state', async () => {
            const { result } = renderHook(() => useAgentController());

            // Set some initial state
            act(() => {
                result.current.setInput('some input');
            });

            await act(async () => { });

            act(() => {
                result.current.logout();
            });

            expect(result.current.session).toBeNull();
            expect(result.current.messages).toEqual([]);
            expect(result.current.mealPlan).toBeNull();
            expect(result.current.shoppingList).toBeNull();
        });
    });

    describe('Message Handling', () => {
        it('sendMessage with input text', async () => {
            mockGetMessages.mockResolvedValueOnce([
                { sender: 'agent', content: 'response' },
            ]);

            const { result } = renderHook(() => useAgentController());

            // Wait for initial effects to complete
            await act(async () => {
                await Promise.resolve();
            });

            await waitFor(() => {
                expect(result.current.session).not.toBeNull();
            });

            act(() => {
                result.current.setInput('Hello world');
            });

            await act(async () => {
                const response = await result.current.sendMessage();
                expect(response).toBeUndefined(); // No meal plan to return
            });

            expect(mockSendAgentMessage).toHaveBeenCalledWith(
                't1',
                'Hello world',
                'user',
                true,
            );
            expect(result.current.input).toBe(''); // Input cleared after send
        });

        it('sendMessage with explicit text parameter', async () => {
            const { result } = renderHook(() => useAgentController());

            await act(async () => {
                await Promise.resolve();
            });

            act(() => {
                result.current.setInput('input text');
            });

            await act(async () => {
                await result.current.sendMessage('explicit text');
            });

            expect(mockSendAgentMessage).toHaveBeenCalledWith(
                't1',
                'explicit text',
                'user',
                true,
            );
            expect(result.current.input).toBe('input text'); // Input not cleared when using explicit text
        });

        it('sendMessage returns newPlan when mealPlan exists', async () => {
            // Mock the useAgentMealSync hook to return a meal plan
            const mockMealPlan = { days: [] } as unknown as import('@mealplanner/generated').WeeklyMealPlan;

            const { result } = renderHook(() => useAgentController());

            await act(async () => {
                await Promise.resolve();
            });

            // Set meal plan through external setter
            act(() => {
                result.current.setMealPlanExternal(mockMealPlan);
            });

            act(() => {
                result.current.setInput('test message');
            });

            await act(async () => {
                const response = await result.current.sendMessage();
                expect(response).toEqual({ newPlan: mockMealPlan });
            });
        });

        it('sendMessage does not send empty message', async () => {
            const { result } = renderHook(() => useAgentController());

            await act(async () => {
                await Promise.resolve();
            });

            act(() => {
                result.current.setInput('   '); // Whitespace only
            });

            await act(async () => {
                const response = await result.current.sendMessage();
                expect(response).toBeUndefined();
            });

            expect(mockSendAgentMessage).not.toHaveBeenCalled();
        });

        it('sendMessage does not send when no session', async () => {
            const { result } = renderHook(() => useAgentController());

            await act(async () => {
                await Promise.resolve();
            });

            // Manually trigger logout to clear session
            act(() => {
                result.current.logout();
            });

            act(() => {
                result.current.setInput('test message');
            });

            await act(async () => {
                const response = await result.current.sendMessage();
                expect(response).toBeUndefined();
            });

            // Should not have called sendMessage API since no session
            expect(mockSendAgentMessage).not.toHaveBeenCalled();
        });
    });

    describe('Input Management', () => {
        it('setInput updates input state', () => {
            const { result } = renderHook(() => useAgentController());

            act(() => {
                result.current.setInput('test input');
            });

            expect(result.current.input).toBe('test input');
        });

        it('setInput with empty string', () => {
            const { result } = renderHook(() => useAgentController());

            act(() => {
                result.current.setInput('initial');
            });

            act(() => {
                result.current.setInput('');
            });

            expect(result.current.input).toBe('');
        });
    });

    describe('External Meal Plan Management', () => {
        it('setMealPlanExternal updates meal plan', () => {
            const { result } = renderHook(() => useAgentController());
            const mockPlan = { days: [{ date: '2023-01-01' }] } as unknown as import('@mealplanner/generated').WeeklyMealPlan;

            act(() => {
                result.current.setMealPlanExternal(mockPlan);
            });

            expect(result.current.mealPlan).toBe(mockPlan);
        });
    });

    describe('Effects and Synchronization', () => {
        it('syncs from checkpoint when session threadId changes', async () => {
            const { result: _result } = renderHook(() => useAgentController());

            await act(async () => {
                await Promise.resolve();
            });

            expect(mockGetAgentCheckpoint).toHaveBeenCalledWith('t1');
        });

        it('updates messages from fetched messages', async () => {
            const mockMessages = [
                { sender: 'user', content: 'Hello' },
                { sender: 'agent', content: 'Hi there' },
            ];

            // Mock getMessages to return our test messages
            mockGetMessages.mockResolvedValue(mockMessages);

            const { result } = renderHook(() => useAgentController());

            // Wait for the hook to initialize and fetch messages
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 10));
            });

            // The messages should be formatted properly
            expect(result.current.messages).toEqual([
                { sender: 'user', text: 'Hello' },
                { sender: 'agent', text: 'Hi there' },
            ]);
        });
    });

    describe('Edge Cases', () => {
        it('handles API errors gracefully', async () => {
            mockSendAgentMessage.mockRejectedValueOnce(new Error('Network error'));

            const { result } = renderHook(() => useAgentController());

            await act(async () => {
                await Promise.resolve();
            });

            act(() => {
                result.current.setInput('test message');
            });

            await act(async () => {
                await expect(result.current.sendMessage()).rejects.toThrow(
                    'Network error',
                );
            });
        });

        it('handles startSession API errors gracefully', async () => {
            mockStartAgentSession.mockRejectedValueOnce(
                new Error('Start session error'),
            );

            const { result } = renderHook(() => useAgentController());

            await act(async () => {
                await expect(result.current.startSession()).rejects.toThrow(
                    'Start session error',
                );
            });
        });
    });
});
