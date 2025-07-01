import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TypingIndicator from './TypingIndicator';

test('renders typing indicator with three dots', () => {
  render(<TypingIndicator />);

  // Check for typing indicator container
  expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();

  // Check for agent avatar
  expect(screen.getByText('A')).toBeInTheDocument();

  // Check for typing dots container
  expect(screen.getByTestId('typing-dots')).toBeInTheDocument();

  // Check for three individual dots
  expect(screen.getByTestId('dot-1')).toBeInTheDocument();
  expect(screen.getByTestId('dot-2')).toBeInTheDocument();
  expect(screen.getByTestId('dot-3')).toBeInTheDocument();
});

test('has proper structure', () => {
  render(<TypingIndicator />);

  const indicator = screen.getByTestId('typing-indicator');
  const dotsContainer = screen.getByTestId('typing-dots');

  expect(indicator).toBeInTheDocument();
  expect(dotsContainer).toBeInTheDocument();
});
