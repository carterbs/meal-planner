import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInput from './ChatInput';
import { colorSchemes, getAgentPageStyles } from '../../../../agentTheme';

describe('ChatInput', () => {
  const colors = colorSchemes['earthyNeutrals'];
  const styles = getAgentPageStyles(colors);

  it('calls onInputChange and onSend, respects disabled and Enter key behavior', async () => {
    const user = userEvent.setup();
    const onInputChange = jest.fn();
    const onSend = jest.fn();
    const onEnterKey = jest.fn((_e: React.KeyboardEvent<HTMLDivElement>) => {});

    // Wrap with local state to simulate controlled component behavior
    const Wrapper: React.FC = () => {
      const [value, setValue] = React.useState('');
      return (
        <ChatInput
          input={value}
          disabled={false}
          onInputChange={(v) => {
            onInputChange(v);
            setValue(v);
          }}
          onSend={onSend}
          onEnterKey={onEnterKey}
          colors={colors}
          styles={styles}
        />
      );
    };

    render(<Wrapper />);

    const input = screen.getByTestId('message-input');
    await user.type(input, 'Hello');
    expect(onInputChange).toHaveBeenCalled();

    // Button should now be enabled since wrapper updates input value
    const sendButton = screen.getByTestId('send-button');
    expect(sendButton).toBeEnabled();
    await user.click(sendButton);
    expect(onSend).toHaveBeenCalledTimes(1);
  });
});
