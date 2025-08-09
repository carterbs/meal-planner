import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatHeader from './ChatHeader';
import { colorSchemes, getAgentPageStyles } from '../../../../theme';

describe('ChatHeader', () => {
  const colors = colorSchemes['earthyNeutrals'];
  const styles = getAgentPageStyles(colors);

  it('renders Start Session when no session and triggers callbacks', async () => {
    const user = userEvent.setup();
    const onStart = jest.fn();
    const onLogout = jest.fn();
    const onOpenLib = jest.fn();

    render(
      <ChatHeader
        hasSession={false}
        onStartSession={onStart}
        onLogout={onLogout}
        onOpenMealLibrary={onOpenLib}
        colors={colors}
        styles={styles}
      />
    );

    const startBtn = screen.getByTestId('start-session');
    await user.click(startBtn);
    expect(onStart).toHaveBeenCalledTimes(1);

    const libraryBtn = screen.getByTestId('open-meal-library');
    await user.click(libraryBtn);
    expect(onOpenLib).toHaveBeenCalledTimes(1);
    expect(onLogout).not.toHaveBeenCalled();
  });

  it('renders Logout when session exists and triggers logout', async () => {
    const user = userEvent.setup();
    const onStart = jest.fn();
    const onLogout = jest.fn();
    const onOpenLib = jest.fn();

    render(
      <ChatHeader
        hasSession={true}
        onStartSession={onStart}
        onLogout={onLogout}
        onOpenMealLibrary={onOpenLib}
        colors={colors}
        styles={styles}
      />
    );

    // start button should not be present
    expect(screen.queryByTestId('start-session')).toBeNull();

    // logout button is the only button without a data-testid, click by role
    const buttons = screen.getAllByRole('button');
    // first button is logout, second is meal library
    await user.click(buttons[0]);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});


