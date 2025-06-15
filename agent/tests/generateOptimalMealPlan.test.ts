import { MealPlannerAgent } from '../agent.js';
import { jest } from '@jest/globals';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

function makeClient(mockResponses: Record<string, any>): Client {
  return {
    callTool: jest.fn(({ name }) => Promise.resolve(mockResponses[name])),
    close: jest.fn(),
  } as unknown as Client;
}

describe('MealPlannerAgent.generateOptimalMealPlan', () => {
  it('returns plan when no issues detected', async () => {
    const plan = {
      days: [
        { dayIndex: 0, meal: { id: 1, name: 'A', effort: 2, hasRedMeat: false } },
      ]
    };
    const client = makeClient({
      generateMealPlan: { content: [{ type: 'text', text: JSON.stringify(plan) }] }
    });
    const agent = new MealPlannerAgent(client);

    const result = await agent.generateOptimalMealPlan();
    expect(result).toEqual(plan);
    expect((client.callTool as jest.Mock).mock.calls[0][0].name).toBe('generateMealPlan');
  });

  it('attempts replacement when issues exist', async () => {
    const initialPlan = {
      days: [
        { dayIndex: 0, meal: { id: 1, name: 'A', effort: 5, hasRedMeat: false } },
        { dayIndex: 1, meal: { id: 1, name: 'A', effort: 5, hasRedMeat: false } },
      ]
    };
    const replacedPlan = {
      days: [
        { dayIndex: 0, meal: { id: 1, name: 'A', effort: 5, hasRedMeat: false } },
        { dayIndex: 1, meal: { id: 2, name: 'B', effort: 1, hasRedMeat: false } },
      ]
    };
    const meals = [
      { id: 2, mealName: 'B', relativeEffort: 1, redMeat: false }
    ];
    const client = makeClient({
      generateMealPlan: { content: [{ type: 'text', text: JSON.stringify(initialPlan) }] },
      getMeals: { content: [{ type: 'text', text: JSON.stringify(meals) }] },
      replaceMeal: { content: [{ type: 'text', text: JSON.stringify(replacedPlan) }] },
    });

    const agent = new MealPlannerAgent(client);
    const result = await agent.generateOptimalMealPlan();

    expect(result).toEqual(replacedPlan);
    expect((client.callTool as jest.Mock).mock.calls.some(c => c[0].name === 'replaceMeal')).toBe(true);
  });
});
