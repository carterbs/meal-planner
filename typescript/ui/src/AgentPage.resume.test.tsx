import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock useSession to simulate a resumed session
jest.mock('./hooks/useSession', () => ({
  __esModule: true,
  default: (startSession: any) => ({
    resumeData: { threadId: 'abc', currentStep: 'planning', mealPlan: { days: [] }, shoppingList: [], messages: [] },
    isResuming: false,
    startNewSession: jest.fn(),
  }),
}));

import AgentPage from './AgentPage';

test('shows End Session button on resume', async () => {
  render(<AgentPage />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /End Session/i })).toBeInTheDocument()
  );
});
