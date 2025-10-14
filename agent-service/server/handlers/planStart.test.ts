import { planStart } from './planStart';
import { PlanStartRequest, PlanStartResponse } from '@mealplanner/generated/agent_pb';

// Mock LangGraphAgent used by the handler
jest.mock('../../langgraph-agent', () => {
    return {
        LangGraphAgent: jest.fn().mockImplementation(() => ({
            initialize: jest.fn().mockResolvedValue(undefined),
            startWorkflow: jest.fn().mockResolvedValue('thread-1'),
            getWorkflowState: jest.fn().mockResolvedValue({
                threadId: 'thread-1',
                participants: ['user'],
                createdAt: new Date(),
                updatedAt: new Date(),
                currentStep: 'initiate',
                mealPlan: {
                    id: 1,
                    items: [
                        {
                            mealType: 'MEAL_SLOT_BREAKFAST',
                            mealSnapshot: { id: 1, name: 'A', effort: 1, hasRedMeat: false },
                        },
                        {
                            dayIndex: 1,
                            mealType: 'MEAL_SLOT_LUNCH',
                            mealSnapshot: { id: 2, name: 'B', effort: 2, hasRedMeat: false },
                        },
                    ],
                },
                feedbackHistory: [],
                iterationCount: 0,
                shoppingList: null,
                isFinalized: false,
            }),
        })),
    };
});

describe('server/handlers/planStart', () => {
    it('starts workflow and normalizes missing dayIndex', async () => {
        const req = new PlanStartRequest({ participants: ['user'] });
        const call = { request: req } as any;
        const callback = jest.fn();
        planStart(call, callback);
        await new Promise((r) => setImmediate(r));
        expect(callback).toHaveBeenCalledTimes(1);
        const [err, resp] = callback.mock.calls[0];
        expect(err).toBeNull();
        expect(resp).toBeInstanceOf(PlanStartResponse);
        const bytes = (resp as PlanStartResponse).initialState;
        const stateJson = new TextDecoder().decode(bytes);
        const state = JSON.parse(stateJson);
        expect(state.mealPlan.items[0].dayIndex).toBe(0);
        expect(state.mealPlan.items[1].dayIndex).toBe(1);
    });

    it('errors when participants missing', async () => {
        const req = new PlanStartRequest({ participants: [] });
        const call = { request: req } as any;
        const callback = jest.fn();
        planStart(call, callback);
        await new Promise((r) => setImmediate(r));
        expect(callback).toHaveBeenCalled();
        const [err] = callback.mock.calls[0];
        expect(err).toBeInstanceOf(Error);
    });
});

