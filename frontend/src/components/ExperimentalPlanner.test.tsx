import React from 'react';
import { render, screen, fireEvent, within, cleanup, setupFetchMocks, cleanupFetchMocks, mockMealPlan } from '../test-utils';
import { ExperimentalPlanner } from './ExperimentalPlanner';

describe('ExperimentalPlanner', () => {
    beforeEach(() => {
        localStorage.clear();
        setupFetchMocks();
    });

    afterEach(() => {
        cleanup();
        cleanupFetchMocks();
    });

    test('auto generates a full week on mount', async () => {
        render(<ExperimentalPlanner />);
        await screen.findByText(mockMealPlan.Monday.mealName);
        const cells = days.flatMap(day => mealTypes.map(mt => screen.getByTestId(`cell-${day}-${mt}`)));
        cells.forEach(cell => {
            expect(cell.textContent).not.toBe('');
        });
    });

    test('skip Monday Lunch', async () => {
        render(<ExperimentalPlanner />);
        const cell = await screen.findByTestId('cell-Mon-Lunch');
        const skipButton = within(cell).getByText('Skip');
        fireEvent.click(skipButton);
        expect(within(cell).getByText('Skipped')).toHaveStyle('text-decoration: line-through');
    });

    test('editing after shopping list shows banner', async () => {
        render(<ExperimentalPlanner />);
        await screen.findByText(mockMealPlan.Monday.mealName);
        fireEvent.click(screen.getByText('Generate Shopping List'));
        const cell = screen.getByTestId('cell-Mon-Breakfast');
        const skipButton = within(cell).getByText('Skip');
        fireEvent.click(skipButton);
        expect(screen.getByText(/Shopping list out of date/)).toBeInTheDocument();
    });

    test('restores latest draft from localStorage', async () => {
        const { unmount } = render(<ExperimentalPlanner />);
        const cell = await screen.findByTestId('cell-Mon-Lunch');
        fireEvent.click(within(cell).getByText('Skip'));
        unmount();
        render(<ExperimentalPlanner />);
        const restored = await screen.findByTestId('cell-Mon-Lunch');
        expect(within(restored).getByText('Skipped')).toBeInTheDocument();
    });
});

const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const mealTypes = ['Breakfast','Lunch','Dinner'];
