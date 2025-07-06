import React from 'react';
import { render, screen } from '@testing-library/react';
import MealPlanDisplay from './MealPlanDisplay';
import { WeeklyMealPlan } from '../types';
import '@testing-library/jest-dom';

function buildPlan(): WeeklyMealPlan {
  const days: WeeklyMealPlan['days'] = [];
  for (let i = 0; i < 7; i++) {
    ['breakfast', 'lunch', 'dinner'].forEach((mt) => {
      days.push({ dayIndex: i, mealType: mt, meal: undefined });
    });
  }
  days[0].meal = {
    id: 1,
    name: 'Eggs',
    effort: 1,
    hasRedMeat: false,
    lastPlanned: new Date(),
    url: '',
    mealType: 'breakfast',
    ingredients: [],
    steps: [],
  };
  days[2 * 3 + 2].meal = {
    id: 2,
    name: 'Steak',
    effort: 3,
    hasRedMeat: true,
    lastPlanned: new Date(),
    url: '',
    mealType: 'dinner',
    ingredients: [],
    steps: [],
  }; // Wednesday dinner
  return { days, shoppingList: [] };
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
});
