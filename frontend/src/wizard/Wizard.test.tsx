import React from 'react';
import { render, screen, fireEvent } from '../test-utils';
import Wizard from './Wizard';
import '@testing-library/jest-dom';

// Simple test to ensure wizard renders start screen and navigates to first day

describe('Wizard', () => {
  test('starts and shows first day', () => {
    render(<Wizard />);
    // Start screen
    expect(screen.getByText('Start Planning')).toBeInTheDocument();
    // begin
    fireEvent.click(screen.getByText('Begin'));
    // Should show plan for Monday
    expect(screen.getByText('Plan Monday')).toBeInTheDocument();
  });
});
