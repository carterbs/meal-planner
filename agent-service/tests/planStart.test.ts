import { planStart } from '../handlers';
import {
  PlanStartRequest,
  PlanStartResponse,
} from '@mealplanner/generated/agent_pb';

// Mock LangGraphAgent to control startWorkflow and initial state
jest.mock('../langgraph-agent', () => {
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
          // Monday missing dayIndex should default to 0
          days: [
            {
              mealType: 'breakfast',
              meal: { id: 1, name: 'A', effort: 1, hasRedMeat: false },
            },
            {
              dayIndex: 1,
              mealType: 'lunch',
              meal: { id: 2, name: 'B', effort: 2, hasRedMeat: false },
            },
          ],
        },
        feedbackHistory: [],
        iterationCount: 0,
        shoppingList: null,
        isFinalized: false,
      }),
      isAwaitingFeedback: jest.fn(),
      resumeWorkflow: jest.fn(),
    })),
  };
});

describe('planStart handler', () => {
  it('applies default dayIndex values when missing', async () => {
    const req = new PlanStartRequest({ participants: ['user'] });
    const call = { request: req } as any;
    const callback = jest.fn();

    // Invoke handler
    planStart(call, callback);
    // Wait for async callback
    await new Promise((resolve) => setImmediate(resolve));

    // Ensure callback was called once
    expect(callback).toHaveBeenCalledTimes(1);
    const [err, resp] = callback.mock.calls[0];
    // No error
    expect(err).toBeNull();
    // Response is correct type
    expect(resp).toBeInstanceOf(PlanStartResponse);

    // Decode initial state JSON
    const bytes = (resp as PlanStartResponse).initialState;
    const stateJson = new TextDecoder().decode(bytes);
    const state = JSON.parse(stateJson);

    // Monday (first entry) should have dayIndex = 0
    expect(state.mealPlan.days[0].dayIndex).toBe(0);
    // Lunch entry preserved
    expect(state.mealPlan.days[1].dayIndex).toBe(1);
  });
});
