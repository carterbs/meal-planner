import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import Header from './Header';

describe('Header', () => {
  it('renders title and triggers back', async () => {
    const onBack = jest.fn();
    render(<Header onBack={onBack} />);
    expect(screen.getByText('Meal Library')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('triggers close when provided', async () => {
    const onClose = jest.fn();
    render(<Header onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders add button when onAdd provided', async () => {
    const onAdd = jest.fn();
    render(<Header onAdd={onAdd} />);
    await userEvent.click(screen.getByRole('button', { name: /add recipe/i }));
    expect(onAdd).toHaveBeenCalled();
  });
});
