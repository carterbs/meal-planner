import React from 'react';
import { render, screen, fireEvent, within, cleanup } from '../test-utils';
import { ExperimentalPlanner } from './ExperimentalPlanner';

describe('ExperimentalPlanner', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        cleanup();
    });

    test('auto generates a full week on mount', () => {
        render(<ExperimentalPlanner />);
        const cells = days.flatMap(day => mealTypes.map(mt => screen.getByTestId(`cell-${day}-${mt}`)));
        cells.forEach(cell => {
            expect(cell.textContent).not.toBe('');
        });
    });

    test('skip Monday Lunch', () => {
        render(<ExperimentalPlanner />);
        const cell = screen.getByTestId('cell-Mon-Lunch');
        const skipButton = within(cell).getByText('Skip');
        fireEvent.click(skipButton);
        expect(within(cell).getByText('Skipped')).toHaveStyle('text-decoration: line-through');
    });

    test('editing after shopping list shows banner', () => {
        render(<ExperimentalPlanner />);
        fireEvent.click(screen.getByText('Generate Shopping List'));
        const cell = screen.getByTestId('cell-Mon-Breakfast');
        const skipButton = within(cell).getByText('Skip');
        fireEvent.click(skipButton);
        expect(screen.getByText(/Shopping list out of date/)).toBeInTheDocument();
    });

    test('restores latest draft from localStorage', () => {
        const { unmount } = render(<ExperimentalPlanner />);
        const cell = screen.getByTestId('cell-Mon-Lunch');
        fireEvent.click(within(cell).getByText('Skip'));
        unmount();
        render(<ExperimentalPlanner />);
        expect(within(screen.getByTestId('cell-Mon-Lunch')).getByText('Skipped')).toBeInTheDocument();
    });
});

const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const mealTypes = ['Breakfast','Lunch','Dinner'];
