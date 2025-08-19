import React from 'react';
import { render, screen } from '@testing-library/react';
import Connecting from './Connecting';

describe('Connecting', () => {
  it('renders static content', () => {
    render(<Connecting />);
    expect(screen.getByText('Connecting to server...')).toBeInTheDocument();
  });

  it('renders service health list when provided', () => {
    render(<Connecting services={{ api: true, agent: false }} />);
    expect(screen.getByText('api: healthy')).toBeInTheDocument();
    expect(screen.getByText('agent: unhealthy')).toBeInTheDocument();
  });
});
