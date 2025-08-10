import { planFeedback } from './planFeedback';
import { PlanFeedbackRequest, PlanFeedbackResponse } from '@mealplanner/generated/agent_pb';

jest.mock('../../langgraph-agent', () => {
    return {
        LangGraphAgent: jest.fn().mockImplementation(() => ({
            initialize: jest.fn().mockResolvedValue(undefined),
            resumeWorkflow: jest.fn().mockResolvedValue({ success: true, message: 'ok', currentStep: 'await_feedback' }),
        })),
    };
});

describe('server/handlers/planFeedback', () => {
    it('validates input and returns response', async () => {
        const req = new PlanFeedbackRequest({ threadId: 't', from: 'user', message: 'hi' });
        const call = { request: req } as any;
        const callback = jest.fn();
        planFeedback(call, callback);
        await new Promise((r) => setImmediate(r));
        const [err, resp] = callback.mock.calls[0];
        expect(err).toBeNull();
        expect(resp).toBeInstanceOf(PlanFeedbackResponse);
    });
    it('errors on missing fields', async () => {
        const req = new PlanFeedbackRequest({ threadId: '', from: '', message: '' } as any);
        const call = { request: req } as any;
        const callback = jest.fn();
        planFeedback(call, callback);
        await new Promise((r) => setImmediate(r));
        expect(callback).toHaveBeenCalled();
        expect(callback.mock.calls[0][0]).toBeInstanceOf(Error);
    });
});


