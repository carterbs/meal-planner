import { describe, it, jest, expect } from '@jest/globals';
import { generateMealPlan } from '../src/tools/generateMealPlan.js';
import { finalizePlan } from '../src/tools/finalizeMealPlan.js';
import { doSwapMeal } from '../src/tools/swapMeal.js';
describe('MCP Tools', () => {
    it('generateMealPlan', async () => {
        const data = { plan: { days: [], shopping_list: [] } };
        global.fetch = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            json: async () => data,
        });
        const result = await generateMealPlan();
        expect(result).toEqual({ plan: { days: [], shoppingList: [] } });
        jest.resetAllMocks();
    });
    it('finalizePlan', async () => {
        const data = { message: "Plan finalized successfully" };
        global.fetch = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            json: async () => data,
        });
        const result = await finalizePlan();
        expect(result).toEqual({ message: "Plan finalized successfully" });
        jest.resetAllMocks();
    });
    it('swapMeal', async () => {
        const data = { meal: { id: 1, name: "Test Meal", effort: 3, has_red_meat: false, url: "", meal_type: "dinner", ingredients: [], steps: [] } };
        global.fetch = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            json: async () => data,
        });
        const result = await doSwapMeal(0);
        expect(result).toEqual({ meal: { id: 1, name: "Test Meal", effort: 3, hasRedMeat: false, url: "", mealType: "", ingredients: [], steps: [], lastPlanned: undefined } });
        jest.resetAllMocks();
    });
});
