import React from 'react';
import { Box, Paper, Avatar, styled, keyframes } from '@mui/material';

const bounce = keyframes`
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-10px);
  }
`;

const Dot = styled('div')(({ theme }) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: theme.palette.grey[600],
  animation: `${bounce} 1.4s infinite ease-in-out`,
  '&:nth-of-type(1)': {
    animationDelay: '0s',
  },
  '&:nth-of-type(2)': {
    animationDelay: '0.2s',
  },
  '&:nth-of-type(3)': {
    animationDelay: '0.4s',
  },
}));

const TypingIndicator: React.FC = () => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1 }} data-testid="typing-indicator">
      <Paper sx={{ p: 1, maxWidth: '70%', backgroundColor: '#fff' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ width: 24, height: 24 }}>A</Avatar>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', py: 0.5 }} data-testid="typing-dots">
            <Dot data-testid="dot-1" />
            <Dot data-testid="dot-2" />
            <Dot data-testid="dot-3" />
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default TypingIndicator;