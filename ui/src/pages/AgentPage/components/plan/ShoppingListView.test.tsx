import React from 'react';
import { render, screen } from '@testing-library/react';
import ShoppingListView from './ShoppingListView';
import { ShoppingListItem } from '@mealplanner/generated';

describe('ShoppingListView', () => {
  const styles = {
    shoppingListItem: {},
  } as unknown as ReturnType<
    typeof import('../../../../theme').getAgentPageStyles
  >;

  it('renders items with quantity when > 0 and category when present', () => {
    const items: ShoppingListItem[] = [
      new ShoppingListItem({ ingredient: 'Tomatoes', quantity: '2', category: 'produce' }),
      new ShoppingListItem({ ingredient: 'Salt', quantity: '0', category: '' }),
      new ShoppingListItem({ ingredient: 'Pepper' }),
    ];

    render(<ShoppingListView items={items} styles={styles} />);

    expect(screen.getByText('2 Tomatoes (produce)')).toBeInTheDocument();
    expect(screen.getByText('Salt')).toBeInTheDocument();
    expect(screen.getByText('Pepper')).toBeInTheDocument();
  });

  it('omits quantity when not positive', () => {
    const items: ShoppingListItem[] = [
      new ShoppingListItem({ ingredient: 'Sugar', quantity: '0' }),
      new ShoppingListItem({ ingredient: 'Flour', quantity: '-1' }),
      new ShoppingListItem({ ingredient: 'Oil', quantity: 'not-a-number' }),
    ];

    render(<ShoppingListView items={items} styles={styles} />);

    expect(screen.getByText('Sugar')).toBeInTheDocument();
    expect(screen.getByText('Flour')).toBeInTheDocument();
    expect(screen.getByText('Oil')).toBeInTheDocument();
  });
});
