import React from 'react';
import { render, screen } from '@testing-library/react';
import ShoppingListView from './ShoppingListView';

describe('ShoppingListView', () => {
  const styles: any = { shoppingListItem: {} };

  it('renders items with quantity when > 0 and category when present', () => {
    const items: any[] = [
      { ingredient: 'Tomatoes', quantity: 2, category: 'produce' },
      { ingredient: 'Salt', quantity: 0, category: '' },
      { ingredient: 'Pepper', quantity: undefined },
    ];

    render(<ShoppingListView items={items as any} styles={styles} />);

    expect(screen.getByText('2 Tomatoes (produce)')).toBeInTheDocument();
    expect(screen.getByText('Salt')).toBeInTheDocument();
    expect(screen.getByText('Pepper')).toBeInTheDocument();
  });

  it('omits quantity when not positive', () => {
    const items: any[] = [
      { ingredient: 'Sugar', quantity: '0' },
      { ingredient: 'Flour', quantity: -1 },
      { ingredient: 'Oil', quantity: 'not-a-number' },
    ];

    render(<ShoppingListView items={items as any} styles={styles} />);

    expect(screen.getByText('Sugar')).toBeInTheDocument();
    expect(screen.getByText('Flour')).toBeInTheDocument();
    expect(screen.getByText('Oil')).toBeInTheDocument();
  });
});
