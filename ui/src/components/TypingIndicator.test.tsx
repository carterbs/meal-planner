import React from 'react';
import { render, screen } from '@testing-library/react';
import TypingIndicator from './TypingIndicator';

describe('TypingIndicator', () => {
  it('renders container and three dots', () => {
    render(<TypingIndicator />);
    expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('typing-dots')).toBeInTheDocument();
    // individual dots
    expect(screen.getByTestId('dot-1')).toBeInTheDocument();
    expect(screen.getByTestId('dot-2')).toBeInTheDocument();
    expect(screen.getByTestId('dot-3')).toBeInTheDocument();
  });
});
