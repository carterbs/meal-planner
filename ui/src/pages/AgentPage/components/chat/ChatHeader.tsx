import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import {
  RestaurantMenu as RestaurantMenuIcon,
  ExitToApp as ExitToAppIcon,
  MenuBook as MenuBookIcon,
} from '@mui/icons-material';
import { Colors, getAgentPageStyles } from '../../../../theme';

type AgentStyles = ReturnType<typeof getAgentPageStyles>;

interface ChatHeaderProps {
  hasSession: boolean;
  onStartSession: () => void;
  onLogout: () => void;
  onOpenMealLibrary: () => void;
  colors: Colors;
  styles: AgentStyles;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  hasSession,
  onStartSession,
  onLogout,
  onOpenMealLibrary,
  colors,
  styles,
}) => {
  return (
    <Box sx={styles.chatHeader}>
      <RestaurantMenuIcon sx={{ mr: 2, color: colors.accent2 }} />
      <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
        Meal Planner
      </Typography>

      {hasSession ? (
        <Button onClick={onLogout} size="small" sx={{ color: colors.accent2 }}>
          <ExitToAppIcon />
        </Button>
      ) : (
        <Button
          onClick={onStartSession}
          data-testid="start-session"
          size="small"
          sx={{ color: colors.apricot }}
        >
          Start Session
        </Button>
      )}
      <Button
        onClick={onOpenMealLibrary}
        size="small"
        sx={{ color: colors.accent2 }}
        data-testid="open-meal-library"
      >
        <MenuBookIcon />
      </Button>
    </Box>
  );
};

export default ChatHeader;
