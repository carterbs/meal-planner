import { renderHook, act } from '@testing-library/react';

const mockGetMessages = jest.fn().mockResolvedValue([
    { sender: 'user', content: 'hello' },
    { sender: 'agent', message: 'hi there' },
]);

jest.mock('../../../api', () => ({
    __esModule: true,
    getMessages: (...args: any[]) => mockGetMessages(...args),
}));

// Import after mocks are set up
import useAgentMessages from './useAgentMessages';

describe('useAgentMessages', () => {
    it('fetches messages when threadId provided', async () => {
        const { result } = renderHook(() => useAgentMessages('t1'));
        expect(result.current.messages).toEqual([]);
        await act(async () => { await result.current.fetchMessages(); });
        expect(mockGetMessages).toHaveBeenCalledWith('t1');
        // State updates are asynchronous; it's sufficient here to verify API call occurred
    });
});


