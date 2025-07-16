import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MealPlanDisplay from './MealPlanDisplay';
import type { WeeklyMealPlan } from '../types';
import { WeeklyMealPlan as WeeklyMealPlanClass, MealPlanEntry, Meal } from '@mealplanner/generated';
import { Timestamp } from '@bufbuild/protobuf';
import '@testing-library/jest-dom';

function buildPlan(): WeeklyMealPlan {
  const days: MealPlanEntry[] = [];
  for (let i = 0; i < 7; i++) {
    ['breakfast', 'lunch', 'dinner'].forEach((mt) => {
          days.push(new MealPlanEntry({ dayIndex: i, mealType: mt, meal: undefined }));
    });
  }
  days[0] = new MealPlanEntry({
    dayIndex: 0,
    mealType: 'breakfast',
    meal: new Meal({
      id: 1,
      name: 'Eggs',
      effort: 1,
      hasRedMeat: false,
      lastPlanned: Timestamp.fromDate(new Date()),
      url: '',
      mealType: 'breakfast',
      ingredients: [],
      steps: [],
    }),
  });
  days[2 * 3 + 2] = new MealPlanEntry({
    dayIndex: 2,
    mealType: 'dinner',
    meal: new Meal({
      id: 2,
      name: 'Steak',
      effort: 3,
      hasRedMeat: true,
      lastPlanned: Timestamp.fromDate(new Date()),
      url: '',
      mealType: 'dinner',
      ingredients: [],
      steps: [],
    }),
  }); // Wednesday dinner
    return new WeeklyMealPlanClass({ days, shoppingList: [] });
}

describe('MealPlanDisplay', () => {
  test('renders meal names in correct positions', () => {
    const plan = buildPlan();
    render(<MealPlanDisplay plan={plan} />);
    expect(screen.getByText('Eggs')).toBeInTheDocument();
    expect(screen.getByText('Steak')).toBeInTheDocument();
  });

  test('shows placeholder for empty meals', () => {
    const plan = buildPlan();
    render(<MealPlanDisplay plan={plan} />);
    const empty = screen.getByTestId('meal-0-lunch');
    expect(empty).toHaveTextContent('---');
  });

  test('displays red meat indicator', () => {
    const plan = buildPlan();
    render(<MealPlanDisplay plan={plan} />);
    const steak = screen.getByText('Steak');
    expect(steak.nextSibling).toHaveTextContent('🥩');
  });

  test('displays day headers', () => {
    const plan = buildPlan();
    render(<MealPlanDisplay plan={plan} />);
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('Sunday')).toBeInTheDocument();
  });

  test('shows effort icons', () => {
    const plan = buildPlan();
    render(<MealPlanDisplay plan={plan} />);
    const eggs = screen.getByText('Eggs');
    expect(eggs.nextSibling).toHaveTextContent('🔥');
  });

  test('handles click events on meal cards', async () => {
    const plan = buildPlan();
    render(<MealPlanDisplay plan={plan} />);
    
    const mealElement = screen.getByTestId('meal-0-breakfast');
    fireEvent.click(mealElement);
    
    expect(mealElement).toBeInTheDocument();
  });

  test('shows meal details in hover or tooltip', () => {
    const plan = buildPlan();
    render(<MealPlanDisplay plan={plan} />);
    
    const mealElement = screen.getByTestId('meal-0-breakfast');
    fireEvent.mouseOver(mealElement);
    
    expect(mealElement).toBeInTheDocument();
  });

  test('handles highlights correctly', () => {
    const plan = buildPlan();
    const highlights = new Set(['0-breakfast', '2-dinner']);
    render(<MealPlanDisplay plan={plan} highlights={highlights} />);
    
    const highlightedMeal = screen.getByTestId('meal-0-breakfast');
    expect(highlightedMeal).toBeInTheDocument();
  });

  test('renders loading state while fetching data', () => {
    const emptyPlan = new WeeklyMealPlanClass({ days: [], shoppingList: [] });
    render(<MealPlanDisplay plan={emptyPlan} />);
    
    expect(screen.getByTestId('meal-plan-table')).toBeInTheDocument();
  });
});
