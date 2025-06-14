import { describe, it, jest, expect } from '@jest/globals';
import { fetchWeeklyMealPlan } from '../src/resources/weeklyMealPlan.js';
import { fetchRecipes } from '../src/resources/recipes.js';
import { fetchRecipeSteps } from '../src/resources/recipeSteps.js';

describe('MCP Resources', () => {
  it('fetches weekly meal plan', async () => {
    const data = { days: [] };
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => data,
    });

    const result = await fetchWeeklyMealPlan();
    expect(result).toEqual(data);

    jest.resetAllMocks();
  });

  it('fetches recipes', async () => {
    const data = [{ id: 1, name: 'A', redMeat: false, effort: 'LOW' }];
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => data,
    });

    const result = await fetchRecipes();
    expect(result).toEqual(data);

    jest.resetAllMocks();
  });

  it('fetches recipe steps', async () => {
    const data = [{ order: 1, text: 'do' }];
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => data,
    });

    const result = await fetchRecipeSteps(5);
    expect(result).toEqual(data);

    jest.resetAllMocks();
  });
});
