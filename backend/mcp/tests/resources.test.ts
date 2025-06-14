import nock from 'nock';
import { fetchWeeklyMealPlan } from '../src/resources/weeklyMealPlan.js';
import { fetchRecipes } from '../src/resources/recipes.js';
import { fetchRecipeSteps } from '../src/resources/recipeSteps.js';
import { API } from '../src/utils.js';

describe('MCP Resources', () => {
  afterEach(() => nock.cleanAll());

  it('fetches weekly meal plan', async () => {
    const data = { days: [] };
    nock(API).get('/api/mealplan').reply(200, data);
    await expect(fetchWeeklyMealPlan()).resolves.toEqual(data);
  });

  it('fetches recipes', async () => {
    const data = [{ id: 1, name: 'A', redMeat: false, effort: 'LOW' }];
    nock(API).get('/api/meals').reply(200, data);
    await expect(fetchRecipes()).resolves.toEqual(data);
  });

  it('fetches recipe steps', async () => {
    const data = [{ order: 1, text: 'do' }];
    nock(API).get('/api/meals/5/steps').reply(200, data);
    await expect(fetchRecipeSteps(5)).resolves.toEqual(data);
  });
});
