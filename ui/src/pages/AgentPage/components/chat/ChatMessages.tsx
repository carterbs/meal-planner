import React from 'react';
import { Box, Avatar, Typography } from '@mui/material';
import { RestaurantMenu as RestaurantMenuIcon } from '@mui/icons-material';
import TypingIndicator from '../../../../components/TypingIndicator';
import { getAgentPageStyles } from '../../../../theme';
import type { ChatMessage } from './ChatPanel';

type AgentStyles = ReturnType<typeof getAgentPageStyles>;

interface ChatMessagesProps {
  messages: ChatMessage[];
  isWorking: boolean;
  styles: AgentStyles;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  isWorking,
  styles,
}) => {
  if (messages.length === 0 && !isWorking) {
    return (
      <Box sx={styles.welcomeMessage}>
        <RestaurantMenuIcon sx={styles.restaurantIcon} />
        <Typography variant="h6" color="text.secondary">
          Welcome to Meal Planning Assistant
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, maxWidth: '500px' }}>
          Start by telling me about your dietary preferences, and I'll help you
          create a personalized meal plan.
        </Typography>
      </Box>
    );
  }

  return (
    <>
      {messages.map((message, index) => (
        <Box
          key={index}
          sx={styles.messageContainer(message.sender === 'user')}
        >
          <Box sx={styles.messageContent(message.sender === 'user')}>
            <Avatar sx={styles.avatar}>
              {message.sender === 'agent' ? 'AI' : 'You'}
            </Avatar>
            <Box sx={styles.messageBubble(message.sender === 'user')}>
              <Typography
                variant="body2"
                sx={{
                  lineHeight: 1.5,
                  fontSize: '0.9375rem',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {message.text}
              </Typography>
            </Box>
          </Box>
        </Box>
      ))}
      {isWorking && <TypingIndicator />}
    </>
  );
};

export default ChatMessages;
