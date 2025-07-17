import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the generated gateway functions
jest.mock('@mealplanner/generated/dist/gateway/index.js', () => ({
  getWorkflowsByThreadIdMessages: jest.fn(),
  postWorkflowsByThreadIdAbandon: jest.fn(),
}));

// Mock the client creation
jest.mock('@mealplanner/generated/dist/gateway/client/index.js', () => ({
  createClient: jest.fn(() => ({})),
  createConfig: jest.fn(() => ({})),
}));

// Mock the API functions
jest.mock('./api', () => ({
  getMessages: jest.fn(),
  startAgentSession: jest.fn(),
  sendAgentMessage: jest.fn(),
  getAgentCheckpoint: jest.fn(),
}));

// Create a stable resumeData object to prevent infinite loops
const stableResumeData = {
  threadId: 'abc',
  currentStep: 'planning',
  mealPlan: { days: [] },
  shoppingList: [],
  messages: []
};

// Mock useSession to simulate a resumed session with stable data
jest.mock('./hooks/useSession', () => ({
  __esModule: true,
  default: (startSession: any) => ({
    resumeData: stableResumeData,
    isResuming: false,
    startNewSession: jest.fn(),
  }),
}));

import AgentPage from './AgentPage';
import { getMessages } from './api';

describe('AgentPage Resume Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the getMessages API call to return empty messages to prevent loops
    (getMessages as jest.Mock).mockResolvedValue([]);
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => null),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('shows End Session button on resume', async () => {
    render(<AgentPage />);
    
    // Wait for the component to process the resumeData and set session state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /End Session/i })).toBeInTheDocument();
    }, { timeout: 10000 });
    
    // Verify the session was restored
    expect(getMessages).toHaveBeenCalledWith('abc');
  });
});
