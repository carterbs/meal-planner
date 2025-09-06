import React from 'react';
import { render, screen } from '@testing-library/react';
import ChatMessages from './ChatMessages';
import { colorSchemes, getAgentPageStyles } from '../../../../agentTheme';

describe('ChatMessages', () => {
  const colors = colorSchemes['earthyNeutrals'];
  const styles = getAgentPageStyles(colors);

  it('renders welcome message when no messages and not working', () => {
    render(
      <div>
        {/* wrapper ensures styles available */}
        <ChatMessages messages={[]} isWorking={false} styles={styles} />
      </div>,
    );
    expect(
      screen.getByText('Welcome to Meal Planning Assistant'),
    ).toBeInTheDocument();
  });

  it('renders messages and typing indicator when working', () => {
    render(
      <ChatMessages
        messages={[
          { sender: 'user', text: 'Hello' },
          { sender: 'agent', text: 'Hi there' },
        ]}
        isWorking={true}
        styles={styles}
      />,
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there')).toBeInTheDocument();
    expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
  });
});
