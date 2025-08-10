import { convertGatewayMealPlan } from './mealPlanConverter';

describe('mealPlanConverter', () => {
  it('converts undefined mealPlan to empty WeeklyMealPlan', () => {
    const result = convertGatewayMealPlan(undefined);
    expect(result.days.length).toBe(0);
  });

  it('converts entries and handles string and object meal forms', () => {
    const input = {
      days: [
        {
          dayIndex: 1,
          mealType: 'dinner',
          meal: JSON.stringify({
            id: 10,
            name: 'Pasta',
            ingredients: [],
            steps: [],
          }),
        },
        {
          dayIndex: 2,
          mealType: 'lunch',
          meal: { id: 20, name: 'Salad', ingredients: [], steps: [] },
        },
      ],
    } as any;

    const result = convertGatewayMealPlan(input);
    expect(result.days.length).toBe(2);
    expect(result.days[0].dayIndex).toBe(1);
    expect(result.days[0].mealType).toBe('dinner');
    expect(result.days[0].meal?.id).toBe(10);
    expect(result.days[1].meal?.id).toBe(20);
  });

  it('sets sensible defaults and converts timestamps', () => {
    const input = {
      days: [
        {
          dayIndex: undefined,
          mealType: undefined,
          meal: {
            id: undefined,
            name: undefined,
            effort: undefined,
            hasRedMeat: undefined,
            url: undefined,
            mealType: undefined,
            lastPlanned: { seconds: 1 },
            ingredients: [
              {
                id: undefined,
                mealId: undefined,
                name: undefined,
                quantity: undefined,
                unit: undefined,
              },
            ],
            steps: [
              {
                id: undefined,
                mealId: undefined,
                stepNumber: undefined,
                instruction: undefined,
              },
            ],
          },
        },
      ],
    } as any;

    const result = convertGatewayMealPlan(input);
    const meal = result.days[0].meal!;
    expect(result.days[0].dayIndex).toBe(0);
    expect(result.days[0].mealType).toBe('');
    expect(meal.id).toBe(0);
    expect(meal.name).toBe('');
    expect(meal.effort).toBe(0);
    expect(meal.hasRedMeat).toBe(false);
    expect(meal.url).toBe('');
    expect(meal.mealType).toBe('');
    expect(meal.lastPlanned).toBeDefined();
    expect(meal.ingredients[0].id).toBe(0);
    expect(meal.steps[0].stepNumber).toBe(0);
  });

  it('handles lastPlanned as ISO string', () => {
    const input = {
      days: [
        {
          meal: {
            id: 1,
            ingredients: [],
            steps: [],
            lastPlanned: '2020-01-01T00:00:00.000Z',
          },
        },
      ],
    } as any;
    const result = convertGatewayMealPlan(input);
    expect(result.days[0].meal?.lastPlanned).toBeDefined();
  });
});
