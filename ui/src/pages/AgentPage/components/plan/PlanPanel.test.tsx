import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlanPanel from './PlanPanel';
import { WeeklyMealPlan, ShoppingListItem } from '@mealplanner/generated';
import { colorSchemes } from '../../../../theme';

describe('PlanPanel', () => {
  const colors = colorSchemes['earthyNeutrals'];

  function makePlan(): WeeklyMealPlan {
    return new WeeklyMealPlan({ days: [] });
  }

  function makeShopping(): ShoppingListItem[] {
    return [new ShoppingListItem({ ingredient: 'Eggs', quantity: '12', category: '' })];
  }

  it('renders empty state when no data', () => {
    render(
      <PlanPanel
        mealPlan={null}
        shoppingList={null}
        currentTab={0}
        onTabChange={() => {}}
        highlights={new Set()}
        onCopyMealPlan={() => {}}
        onCopyShoppingList={() => {}}
        colors={colors}
      />
    );
    expect(screen.getByText('No meal plan generated yet')).toBeInTheDocument();
  });

  it('switches tabs and enables share menu buttons based on data', async () => {
    const user = userEvent.setup();
    const onTabChange = jest.fn();
    render(
      <PlanPanel
        mealPlan={makePlan()}
        shoppingList={makeShopping()}
        currentTab={0}
        onTabChange={onTabChange}
        highlights={new Set()}
        onCopyMealPlan={() => {}}
        onCopyShoppingList={() => {}}
        colors={colors}
      />
    );

    const planTab = screen.getByRole('button', { name: 'Meal Plan' });
    const listTab = screen.getByRole('button', { name: 'Shopping List' });
    expect(planTab).toBeEnabled();
    expect(listTab).toBeEnabled();
    await user.click(listTab);
    expect(onTabChange).toHaveBeenCalledWith(1);
  });
});


