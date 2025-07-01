import { describe, it, jest, expect } from '@jest/globals';
import { generateMealPlan } from '../src/tools/generateMealPlan.js';
import { finalizePlan } from '../src/tools/finalizeMealPlan.js';
import { doSwapMeal } from '../src/tools/swapMeal.js';

describe('MCP Tools', () => {
  it('generateMealPlan', async () => {
    const data = { days: [] };
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => data,
    });

    const result = await generateMealPlan();
    expect(result).toEqual(data);

    jest.resetAllMocks();
  });

  it('finalizePlan', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => 'Plan finalized',
    });

    const result = await finalizePlan();
    expect(result).toBe('Plan finalized');

    jest.resetAllMocks();
  });

  it('swapMeal', async () => {
    const data = { days: [] };
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => data,
    });

    const result = await doSwapMeal(0);
    expect(result).toEqual(data);

    jest.resetAllMocks();
  });
});