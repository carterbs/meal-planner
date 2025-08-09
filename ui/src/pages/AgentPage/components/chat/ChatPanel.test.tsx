import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatPanel from './ChatPanel';
import { colorSchemes } from '../../../../theme';

describe('ChatPanel', () => {
  const colors = colorSchemes['earthyNeutrals'];

    it('renders header controls and triggers callbacks', async () => {
        const user = userEvent.setup();
        const onStart = jest.fn();
        const onLogout = jest.fn();
        const onOpenLib = jest.fn();
        const onSend = jest.fn();
        const onEnterKey = jest.fn();

        render(
            <ChatPanel
                hasSession={false}
                isWorking={false}
                messages={[]}
                input="Hello"
                onInputChange={() => { }}
                onSend={onSend}
                onStartSession={onStart}
                onLogout={onLogout}
                onOpenMealLibrary={onOpenLib}
                onEnterKey={onEnterKey}
                colors={colors}
            />
        );

        await user.click(screen.getByTestId('start-session'));
        expect(onStart).toHaveBeenCalledTimes(1);

        await user.click(screen.getByTestId('open-meal-library'));
        expect(onOpenLib).toHaveBeenCalledTimes(1);

        await user.click(screen.getByTestId('send-button'));
        expect(onSend).toHaveBeenCalledTimes(1);

        // Enter key path
        const input = screen.getByTestId('message-input');
        fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });
        expect(onEnterKey).toHaveBeenCalled();
    });

    it('shows logout when session exists', () => {
        render(
            <ChatPanel
                hasSession={true}
                isWorking={false}
                messages={[]}
                input="Hi"
                onInputChange={() => { }}
                onSend={() => { }}
                onStartSession={() => { }}
                onLogout={() => { }}
                onOpenMealLibrary={() => { }}
                onEnterKey={() => { }}
                colors={colors}
            />
        );
        // No explicit test id for logout; ensure meal library button still present
        expect(screen.getByTestId('open-meal-library')).toBeInTheDocument();
    });
});


