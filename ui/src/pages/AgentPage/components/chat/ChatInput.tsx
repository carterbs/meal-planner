import React from 'react';
import { Box, Button, TextField } from '@mui/material';
import { Colors, getAgentPageStyles } from '../../../../theme';

type AgentStyles = ReturnType<typeof getAgentPageStyles>;

interface ChatInputProps {
  input: string;
  disabled: boolean;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onEnterKey: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  colors: Colors;
  styles: AgentStyles;
}

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  disabled,
  onInputChange,
  onSend,
  onEnterKey,
  colors,
  styles,
}) => {
  return (
    <Box sx={styles.chatInputContainer}>
      <Box sx={styles.inputContainer}>
        <TextField
          fullWidth
          variant="outlined"
          size="small"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyPress={onEnterKey}
          disabled={disabled}
          inputProps={{ 'data-testid': 'message-input' }}
        />
        <Button
          variant="contained"
          data-testid="send-button"
          onClick={onSend}
          disabled={!input.trim() || disabled}
          sx={{
            ...styles.sendButton,
            backgroundColor: colors.apricot,
            color: '#ffffff',
            '&:hover': { backgroundColor: '#ff9f2b' },
            '&:disabled': { backgroundColor: '#cccccc' },
          }}
        >
          Send
        </Button>
      </Box>
    </Box>
  );
};

export default ChatInput;
