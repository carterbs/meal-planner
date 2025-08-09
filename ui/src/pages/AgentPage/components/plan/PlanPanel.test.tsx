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
        onTabChange={() => { }}
        highlights={new Set()}
        onCopyMealPlan={() => { }}
        onCopyShoppingList={() => { }}
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
        onCopyMealPlan={() => { }}
        onCopyShoppingList={() => { }}
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

  it('disables Shopping List tab when no shopping list', () => {
    render(
      <PlanPanel
        mealPlan={makePlan()}
        shoppingList={null}
        currentTab={0}
        onTabChange={() => { }}
        highlights={new Set()}
        onCopyMealPlan={() => { }}
        onCopyShoppingList={() => { }}
        colors={colors}
      />
    );
    const listTab = screen.getByRole('button', { name: 'Shopping List' });
    expect(listTab).toBeDisabled();
  });

  it('shows inner empty state when shopping exists but no meal plan and tab is Meal Plan', () => {
    render(
      <PlanPanel
        mealPlan={null}
        shoppingList={makeShopping()}
        currentTab={0}
        onTabChange={() => { }}
        highlights={new Set()}
        onCopyMealPlan={() => { }}
        onCopyShoppingList={() => { }}
        colors={colors}
      />
    );
    expect(screen.getByText('No meal plan generated yet')).toBeInTheDocument();
  });

  it('opens share menu and shows only relevant items (meal plan only)', async () => {
    const user = userEvent.setup();
    const onCopyMealPlan = jest.fn();
    render(
      <PlanPanel
        mealPlan={makePlan()}
        shoppingList={null}
        currentTab={0}
        onTabChange={() => { }}
        highlights={new Set()}
        onCopyMealPlan={onCopyMealPlan}
        onCopyShoppingList={() => { }}
        colors={colors}
      />
    );
    const shareBtn = screen.getByTestId('share-menu-button');
    await user.click(shareBtn);
    const copyPlan = await screen.findByTestId('copy-meal-plan');
    expect(copyPlan).toBeInTheDocument();
    expect(screen.queryByTestId('copy-shopping-list')).toBeNull();
    await user.click(copyPlan);
    expect(onCopyMealPlan).toHaveBeenCalledTimes(1);
  });

  it('opens share menu and triggers both copy actions when available', async () => {
    const user = userEvent.setup();
    const onCopyMealPlan = jest.fn();
    const onCopyShoppingList = jest.fn();
    render(
      <PlanPanel
        mealPlan={makePlan()}
        shoppingList={makeShopping()}
        currentTab={0}
        onTabChange={() => { }}
        highlights={new Set()}
        onCopyMealPlan={onCopyMealPlan}
        onCopyShoppingList={onCopyShoppingList}
        colors={colors}
      />
    );
    const shareBtn = screen.getByTestId('share-menu-button');
    await user.click(shareBtn);
    const copyPlan = await screen.findByTestId('copy-meal-plan');
    await user.click(copyPlan);
    expect(onCopyMealPlan).toHaveBeenCalledTimes(1);

    // Re-open to copy shopping list
    await user.click(shareBtn);
    const copyList = await screen.findByTestId('copy-shopping-list');
    await user.click(copyList);
    expect(onCopyShoppingList).toHaveBeenCalledTimes(1);
  });

  it('renders shopping list items on tab 1', () => {
    render(
      <PlanPanel
        mealPlan={makePlan()}
        shoppingList={makeShopping()}
        currentTab={1}
        onTabChange={() => { }}
        highlights={new Set()}
        onCopyMealPlan={() => { }}
        onCopyShoppingList={() => { }}
        colors={colors}
      />
    );
    expect(screen.getByText(/Eggs/)).toBeInTheDocument();
  });
});


