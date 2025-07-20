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
        const body = { days: [] };
        const result = await finalizePlan(body);
        expect((global as any).fetch).toHaveBeenCalledWith(expect.stringContaining('/api/mealplan/finalize'), expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }));
        expect(FinalizeMealPlanResponse.fromJson).toHaveBeenCalledWith(fakeJson);
        expect(result).toBe(parsed);
    });
    it('throws McpError on bad status', async () => {
        (global as any).fetch.mockResolvedValueOnce({ ok: false, statusText: 'Failure' });
        await expect(finalizePlan({})).rejects.toThrow(McpError);
    });
});
describe('registerFinalizeMealPlan', () => {
    it('registers the tool with correct signature', () => {
        const server: any = { tool: jest.fn() };
        registerFinalizeMealPlan(server);
        expect(server.tool).toHaveBeenCalledWith('finalizeMealPlan', expect.any(String), { mealPlan: expect.objectContaining({ type: 'object' }) }, expect.any(Function));
    });
});
