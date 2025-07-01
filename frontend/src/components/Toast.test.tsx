import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Toast } from './Toast';
import '@testing-library/jest-dom';

describe('Toast', () => {
  const theme = createTheme();

  test('renders message when provided', () => {
    render(
      <ThemeProvider theme={theme}>
        <Toast message="Saved" />
      </ThemeProvider>
    );
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  test('renders nothing when message is null', () => {
    const { container } = render(
      <ThemeProvider theme={theme}>
        <Toast message={null} />
      </ThemeProvider>
    );
    expect(container.firstChild).toBeNull();
  });
});
