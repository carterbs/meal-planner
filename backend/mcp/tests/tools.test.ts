import nock from 'nock';
import { generateMealPlan } from '../src/tools/generateMealPlan.js';
import { finalizePlan } from '../src/tools/finalizeMealPlan.js';
import { doSwapMeal } from '../src/tools/swapMeal.js';
import { API } from '../src/utils.js';

describe('MCP Tools', () => {
  afterEach(() => nock.cleanAll());

  it('generateMealPlan', async () => {
    const data = { days: [] };
    nock(API).post('/api/mealplan/generate').reply(200, data);
    await expect(generateMealPlan()).resolves.toEqual(data);
  });

  it('finalizePlan', async () => {
    nock(API).post('/api/mealplan/finalize').reply(200, { ok: true });
    await expect(finalizePlan()).resolves.toEqual({ ok: true });
  });

  it('swapMeal', async () => {
    const data = { days: [] };
    nock(API).post('/api/mealplan/swap').reply(200, data);
    await expect(doSwapMeal(0)).resolves.toEqual(data);
  });
});
