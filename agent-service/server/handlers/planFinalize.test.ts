import { planFinalize } from './planFinalize';
import { PlanFinalizeRequest, PlanFinalizeResponse } from '@mealplanner/generated/agent_pb';

jest.mock('../../langgraph-agent', () => {
    return {
        LangGraphAgent: jest.fn().mockImplementation(() => ({
            initialize: jest.fn().mockResolvedValue(undefined),
            resumeWorkflow: jest.fn().mockResolvedValue({ success: true, message: 'ok', currentStep: 'generate_shopping_list' }),
        })),
    };
});

describe('server/handlers/planFinalize', () => {
    it('validates threadId and returns response', async () => {
        const req = new PlanFinalizeRequest({ threadId: 't' });
        const call = { request: req } as any;
        const callback = jest.fn();
        planFinalize(call, callback);
        await new Promise((r) => setImmediate(r));
        const [err, resp] = callback.mock.calls[0];
        expect(err).toBeNull();
        expect(resp).toBeInstanceOf(PlanFinalizeResponse);
    });
    it('errors on missing threadId', async () => {
        const req = new PlanFinalizeRequest({ threadId: '' } as any);
        const call = { request: req } as any;
        const callback = jest.fn();
        planFinalize(call, callback);
        await new Promise((r) => setImmediate(r));
        expect(callback).toHaveBeenCalled();
        expect(callback.mock.calls[0][0]).toBeInstanceOf(Error);
    });
});


