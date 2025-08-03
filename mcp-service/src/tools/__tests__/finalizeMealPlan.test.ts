import { finalizePlan, registerFinalizeMealPlan } from '../finalizeMealPlan';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { FinalizeMealPlanResponse } from '@mealplanner/generated';
describe('finalizePlan', () => {
    beforeEach(() => {
        (global as any).fetch = jest.fn();
    });
    it('posts to /api/mealplan/finalize and returns parsed response', async () => {
        const fakeJson = { message: 'Plan finalized successfully' };
        (global as any).fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(fakeJson),
            statusText: 'OK',
        });
        const parsed = new FinalizeMealPlanResponse({ message: 'Plan finalized successfully' });
        jest.spyOn(FinalizeMealPlanResponse, 'fromJson').mockReturnValue(parsed);
        const threadId = 'test-thread-123';
        const expectedBody = { thread_id: threadId };
        const result = await finalizePlan(threadId);
        expect((global as any).fetch).toHaveBeenCalledWith(expect.stringContaining('/api/mealplan/finalize'), expect.objectContaining({ method: 'POST', body: JSON.stringify(expectedBody) }));
        expect(FinalizeMealPlanResponse.fromJson).toHaveBeenCalledWith(fakeJson);
        expect(result).toBe(parsed);
    });
    it('throws McpError on bad status', async () => {
        (global as any).fetch.mockResolvedValueOnce({ ok: false, statusText: 'Failure', text: () => Promise.resolve('Error details') });
        await expect(finalizePlan('test-thread')).rejects.toThrow(McpError);
    });
});
describe('registerFinalizeMealPlan', () => {
    it('registers the tool with correct signature', () => {
        const server: any = { tool: jest.fn() };
        registerFinalizeMealPlan(server);
        expect(server.tool).toHaveBeenCalledWith('finalizeMealPlan', 'Finalize the meal plan for the given thread ID.', { threadId: expect.objectContaining({ type: 'string' }) }, expect.any(Function));
    });
});
