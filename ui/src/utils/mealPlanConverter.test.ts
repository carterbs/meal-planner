import { MealSlot } from '@mealplanner/generated';
import { convertGatewayMealPlan } from './mealPlanConverter';

describe('mealPlanConverter', () => {
  it('returns empty MealPlan when input is undefined', () => {
    const result = convertGatewayMealPlan(undefined);
    expect(result.items.length).toBe(0);
  });

  it('converts JSON with enum strings into MealPlan', () => {
    const input = {
      items: [
        {
          dayIndex: 1,
          mealType: 'MEAL_SLOT_DINNER',
          mealSnapshot: {
            id: 10,
            name: 'Pasta',
          },
        },
      ],
    };
    const result = convertGatewayMealPlan(input);
    expect(result.items.length).toBe(1);
    const item = result.items[0];
    expect(item.dayIndex).toBe(1);
    expect(item.mealType).toBe(MealSlot.DINNER);
    expect(item.mealSnapshot?.name).toBe('Pasta');
  });

  it('handles numeric enum values from the gateway', () => {
    const input = {
      items: [
        {
          dayIndex: 2,
          mealType: 1, // breakfast
          mealSnapshot: {
            id: 5,
            name: 'Oatmeal',
          },
        },
      ],
    };
    const result = convertGatewayMealPlan(input);
    expect(result.items[0].mealType).toBe(MealSlot.BREAKFAST);
    expect(result.items[0].mealSnapshot?.id).toBe(5);
  });

  it('ignores unknown fields gracefully', () => {
    const input = {
      items: [
        {
          dayIndex: 0,
          mealType: 'MEAL_SLOT_LUNCH',
          mealSnapshot: { id: 42, name: 'Salad' },
          unknownField: 'ignored',
        },
      ],
      extra: 'ignored',
    };

    const result = convertGatewayMealPlan(input);
    expect(result.items.length).toBe(1);
    expect(result.items[0].mealSnapshot?.name).toBe('Salad');
  });
});
