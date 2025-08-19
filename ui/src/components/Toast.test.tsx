import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Toast } from './Toast';

describe('Toast', () => {
  const theme = createTheme();

  it('returns null when message is null', () => {
    const { container } = render(
      <ThemeProvider theme={theme}>
        <Toast message={null} />
      </ThemeProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders provided message', () => {
    render(
      <ThemeProvider theme={theme}>
        <Toast message={'Saved successfully'} />
      </ThemeProvider>,
    );
    expect(screen.getByText('Saved successfully')).toBeInTheDocument();
  });
});
