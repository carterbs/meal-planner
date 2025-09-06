import React, { forwardRef, useMemo } from 'react';
import { Box, Paper } from '@mui/material';
import { getAgentPageStyles, Colors } from '../../../../agentTheme';
import ChatHeader from './ChatHeader';
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';

export interface ChatMessage {
  sender: 'user' | 'agent';
  text: string;
}

export interface ChatPanelProps {
  hasSession: boolean;
  isWorking: boolean;
  messages: ChatMessage[];
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onStartSession: () => void;
  onLogout: () => void;
  onOpenMealLibrary: () => void;
  onEnterKey: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  colors: Colors;
}

const ChatPanel = forwardRef<HTMLDivElement, ChatPanelProps>(
  (
    {
      hasSession,
      isWorking,
      messages,
      input,
      onInputChange,
      onSend,
      onStartSession,
      onLogout,
      onOpenMealLibrary,
      onEnterKey,
      colors,
    },
    ref,
  ) => {
    const styles = useMemo(() => getAgentPageStyles(colors), [colors]);

    return (
      <Paper elevation={0} sx={{ ...styles.chatContainer, boxShadow: 'none' }}>
        <ChatHeader
          hasSession={hasSession}
          onStartSession={onStartSession}
          onLogout={onLogout}
          onOpenMealLibrary={onOpenMealLibrary}
          colors={colors}
          styles={styles}
        />

        <Box ref={ref} data-testid="chat-history" sx={styles.chatMessages}>
          <ChatMessages
            messages={messages}
            isWorking={isWorking}
            styles={styles}
          />
        </Box>

        <ChatInput
          input={input}
          disabled={isWorking}
          onInputChange={onInputChange}
          onSend={onSend}
          onEnterKey={onEnterKey}
          colors={colors}
          styles={styles}
        />
      </Paper>
    );
  },
);

export default ChatPanel;
