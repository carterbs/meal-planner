import type { SxProps, Theme } from '@mui/material/styles';
import type { CSSProperties } from 'react';

export interface Colors {
  name?: string;
  mainBg: string;
  chatBg: string;
  cardBg: string;
  headerBg: string;
  headerText: string;
  accent: string;
  accent2: string;
  apricot?: string;
  border: string;
  text: string;
  userMsgBg: string;
  aiMsgBg: string;
  changedMealHighlight: string;
}

export const colorSchemes: Record<string, Colors> = {
  sageAndCream: {
    name: 'Sage & Cream',
    mainBg: '#fefcf7',
    chatBg: '#fefcf7',
    cardBg: '#e8f0e5',
    headerBg: '#e8f0e5',
    headerText: '#4a6741',
    accent: '#4a6741',
    accent2: '#c9e0c2',
    border: '#d4d9d1',
    text: '#3a3a3a',
    userMsgBg: '#f4f7f2',
    aiMsgBg: '#f4f7f2',
    changedMealHighlight: '#92ca92',
  },
  earthyNeutrals: {
    name: 'Earthy Neutrals',
    mainBg: '#F7F5F2',
    chatBg: '#ffffff',
    cardBg: '#f7f4f2',
    headerBg: '#f7f4f2',
    headerText: '#3a3a3a',
    accent: '#c9e0c2',
    accent2: '#9aaf94',
    apricot: '#FFB347',
    border: '#e0e4e0',
    text: '#3a3a3a',
    userMsgBg: '#c9e0c2',
    aiMsgBg: '#f7f4f2',
    changedMealHighlight: '#92ca92',
  },
  naturalLinen: {
    name: 'Natural Linen',
    mainBg: '#faf9f6',
    chatBg: '#faf9f6',
    cardBg: '#f0f4f0',
    headerBg: '#f0f4f0',
    headerText: '#3a3a3a',
    accent: '#6b8c5d',
    accent2: '#c9e0c2',
    border: '#d4d9d1',
    text: '#3a3a3a',
    userMsgBg: '#E8F4EC',
    aiMsgBg: '#eef2ee',
    changedMealHighlight: '#92ca92',
  },
};

export const getAgentPageStyles = (colors: Colors) => ({
  appBar: {
    backgroundColor: 'primary.main',
    color: 'primary.contrastText',
  } as SxProps<Theme>,
  mainContainer: {
    display: 'flex',
    flexDirection: 'row',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
  } as SxProps<Theme>,
  contentContainer: {
    display: 'flex',
    flexDirection: 'row',
    flex: 1,
    gap: 0,
    height: '100%',
    width: '100%',
    maxWidth: '100vw',
  } as SxProps<Theme>,
  chatContainer: {
    width: '400px',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 0,
    height: '100vh',
    backgroundColor: colors.chatBg,
  } as SxProps<Theme>,
  chatHeader: {
    backgroundColor: colors.headerBg,
    color: colors.headerText,
    minHeight: '64px',
    display: 'flex',
    alignItems: 'center',
    px: 2,
  } as SxProps<Theme>,
  chatMessages: {
    flex: 1,
    overflowY: 'auto',
    p: 2,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    backgroundColor: colors.chatBg,
    '&::-webkit-scrollbar': {
      width: '6px',
    },
    '&::-webkit-scrollbar-track': {
      backgroundColor: 'transparent',
    },
    '&::-webkit-scrollbar-thumb': (theme: Theme) => ({
      backgroundColor: theme.palette.grey[300],
      borderRadius: '3px',
      '&:hover': {
        backgroundColor: theme.palette.grey[400],
      },
    }),
  } as SxProps<Theme>,
  welcomeMessage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'text.secondary',
    textAlign: 'center',
    p: 4,
  } as SxProps<Theme>,
  messageContainer: (isUser: boolean) =>
    ({
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      mb: 2,
      animation: 'fadeIn 0.3s ease-out',
      width: '100%',
      px: 2,
    }) as SxProps<Theme>,
  messageContent: (isUser: boolean) =>
    ({
      display: 'flex',
      alignItems: 'flex-start',
      gap: '8px',
      maxWidth: '85%',
      flexDirection: isUser ? 'row-reverse' : 'row',
    }) as SxProps<Theme>,
  messageBubble: (isUser: boolean) =>
    ({
      p: 2,
      borderRadius: '12px',
      borderTopLeftRadius: isUser ? '12px' : '4px',
      borderTopRightRadius: isUser ? '4px' : '12px',
      bgcolor: isUser ? colors.userMsgBg : colors.aiMsgBg,
      color: colors.text,
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
      position: 'relative',
      maxWidth: '100%',
      marginLeft: isUser ? 0 : '8px',
      marginRight: isUser ? '8px' : 0,
    }) as SxProps<Theme>,
  avatar: {
    width: 32,
    height: 32,
    bgcolor: colors.cardBg,
    color: colors.text,
    fontSize: '0.6rem',
    fontWeight: 'bold',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '4px',
  } as SxProps<Theme>,
  chatInputContainer: {
    p: 2,
    backgroundColor: colors.chatBg,
    flexShrink: 0,
  } as SxProps<Theme>,
  inputContainer: {
    display: 'flex',
    gap: 1,
  } as SxProps<Theme>,
  sendButton: {
    minWidth: '100px',
  } as SxProps<Theme>,
  mealPlanContainer: {
    flex: 1,
    overflow: 'hidden',
    p: 2,
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: colors.headerBg,
  } as SxProps<Theme>,
  mealPlanPaper: {
    pt: 1,
    px: 2,
    pb: 2,
    flex: 1,
    borderRadius: 2,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  } as SxProps<Theme>,
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    mb: 1,
    pb: 1,
  } as SxProps<Theme>,
  sectionTitle: {
    fontWeight: 600,
  } as SxProps<Theme>,
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'text.secondary',
    textAlign: 'center',
    p: 4,
  } as SxProps<Theme>,
  restaurantIcon: {
    fontSize: 64,
    mb: 2,
    opacity: 0.3,
    color: colors.apricot,
  } as SxProps<Theme>,
  shoppingListItem: {
    display: 'block',
    py: 0.25,
    pl: 0,
  } as SxProps<Theme>,
  checkbox: {
    marginRight: '8px',
  } as CSSProperties,
});
