import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Avatar,
  ThemeProvider,
  CssBaseline,
  createTheme,
  Menu,
  MenuItem,
  IconButton,
} from '@mui/material';
import {
  RestaurantMenu as RestaurantMenuIcon,
  ExitToApp as ExitToAppIcon,
  ExpandMore as ExpandMoreIcon,
  ShoppingCart as ShoppingCartIcon,
  IosShare as ShareIcon,
  MenuBook as MenuBookIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import MealPlanDisplay from './components/MealPlanDisplay';
import { MealManagementTab } from './components/MealManagementTab';
import { Toast } from './components/Toast';
import { ShoppingListItem } from './types';
import { MealPlanEntry, WeeklyMealPlan, Meal } from '@mealplanner/generated';
import {
  startAgentSession,
  sendAgentMessage,
  getAgentCheckpoint,
  getMessages,
  SessionInfo,
  goGetShoppingList,
} from './api';
import TypingIndicator from './components/TypingIndicator';
import useSession from './hooks/useSession';
import {
  createClient,
  createConfig,
} from '@mealplanner/generated/dist/gateway/client/index.js';

import type { SxProps, Theme } from '@mui/material';
import { DAYS_OF_THE_WEEK } from '@meal-planner/shared';
import type { DayOfTheWeek } from '@meal-planner/shared';
import { Timestamp } from '@bufbuild/protobuf';
import { convertGatewayMealPlan } from './utils/mealPlanConverter';

const gatewayClient = createClient(
  createConfig({
    baseUrl: 'http://localhost:8090/api',
  }),
);

// Color scheme definitions
const colorSchemes = {
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
// Style variables - now a function that takes colors
const getStyles = (colors: typeof colorSchemes.earthyNeutrals) => ({
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
    p: 1.5,
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
  } as SxProps<Theme>,
  mealPlanPaper: {
    pt: 1,
    px: 2,
    pb: 1.5,
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
  } as React.CSSProperties,
});

// Custom theme with earthy colors
const theme = createTheme({
  palette: {
    primary: {
      main: '#6b8c5d', // Sage green
      light: '#8baa7d',
      dark: '#4a5e40',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#8b7355', // Warm brown
      light: '#b39f86',
      dark: '#5f4a2f',
      contrastText: '#ffffff',
    },
    background: {
      default: '#ffffff', // White
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h5: {
      fontWeight: 600,
      letterSpacing: '0.5px',
      fontSize: '18px',
    },
    h6: {
      fontWeight: 600,
      fontSize: '18px',
    },
    body1: {
      lineHeight: 1.6,
      fontSize: '14px',
    },
    body2: {
      fontSize: '14px',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: '8px',
          padding: '8px 16px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
      },
    },
  },
});

// Utility to format a WeeklyMealPlan for clipboard copying

function formatMealPlan(plan: WeeklyMealPlan): { html: string; text: string } {
  let html = '<table style="border-collapse: collapse; width: 100%;">';
  html +=
    '<thead><tr>' +
    '<th style="border:1px solid #ddd;padding:8px;text-align:left;">Day</th>' +
    '<th style="border:1px solid #ddd;padding:8px;text-align:left;">Meals</th>' +
    '</tr></thead><tbody>';

  let text = 'Day | Meals\n';
  text += '----|------\n';

  DAYS_OF_THE_WEEK.forEach((day: DayOfTheWeek, idx: number) => {
    const entries = plan.days.filter((d) => d.dayIndex === idx);
    if (entries.length === 0) return;

    const mealsHtml = entries
      .filter((e) => e.meal)
      .map((e) => {
        const meal = e.meal!;
        return `<strong>${e.mealType.charAt(0).toUpperCase() + e.mealType.slice(1)}</strong>: ${meal.name} (${meal.effort})`;
      })
      .join('<br>');
    html +=
      `<tr><td style="border:1px solid #ddd;padding:8px;">${day}</td>` +
      `<td style="border:1px solid #ddd;padding:8px;">${mealsHtml}</td></tr>`;

    const mealsText = entries
      .filter((e) => e.meal)
      .map((e) => {
        const meal = e.meal!;
        return `${e.mealType}: ${meal.name} (${meal.effort})`;
      })
      .join('; ');
    text += `${day} | ${mealsText}\n`;
  });

  html += '</tbody></table>';
  return { html, text };
}

interface ChatMessage {
  sender: 'user' | 'agent';
  text: string;
}

// SessionInfo is now imported from api

const AgentPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [mealPlan, setMealPlan] = useState<WeeklyMealPlan | null>(null);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[] | null>(
    null,
  );
  const [highlights, setHighlights] = useState<Set<string>>(new Set());
  const [currentTab, setCurrentTab] = useState(0);
  const [shareMenuAnchor, setShareMenuAnchor] = useState<null | HTMLElement>(
    null,
  );
  const [showMealLibrary, setShowMealLibrary] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const currentColorScheme = 'earthyNeutrals';
  const chatRef = useRef<HTMLDivElement | null>(null);

  const colors = colorSchemes[currentColorScheme];
  const styles = getStyles(colors);

  useEffect(() => {
    const el = chatRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const applyHighlights = (newPlan: WeeklyMealPlan) => {
    setHighlights((prev) => {
      const changed = new Set<string>();
      if (mealPlan) {
        newPlan.days.forEach((d) => {
          const prevEntry = mealPlan.days.find(
            (p) => p.dayIndex === d.dayIndex && p.mealType === d.mealType,
          );
          const prevId = prevEntry?.meal ? prevEntry.meal.id : null;
          const newId = d.meal ? d.meal.id : null;
          if (prevId !== newId) {
            changed.add(`${d.dayIndex}-${d.mealType}`);
          }
        });
      }

      if (changed.size > 0) {
        setTimeout(() => {
          setHighlights((h) => {
            const copy = new Set(h);
            changed.forEach((k) => copy.delete(k));
            return copy;
          });
        }, 5000);
      }
      return new Set([...prev, ...changed]);
    });
    setMealPlan(newPlan);
  };

  const startSession = async () => {
    setIsWorking(true);
    try {
      const result = await startAgentSession(['user'], 'meal_planning');
      setSession(result.session);
      localStorage.setItem('sessionId', result.session.threadId);

      // Extract meal plan from initial state
      if (result.initialState?.mealPlan) {
        console.log(
          'Setting meal plan from session start:',
          result.initialState.mealPlan,
        );
        setMealPlan(result.initialState.mealPlan);
        setShoppingList(result.initialState.mealPlan.shoppingList);
      }

      if (result.message) {
        setMessages([{ sender: 'agent', text: result.message }]);
      }
    } catch (err) {
      console.error('Failed to start session', err);
    } finally {
      setIsWorking(false);
    }
  };

  const { resumeData, startNewSession } = useSession(startSession);

  const handleLogout = () => {
    setSession(null);
    setMessages([]);
    setMealPlan(null);
    setShoppingList(null);
    startNewSession();
  };

  useEffect(() => {
    if (resumeData) {
      // restore session after reload
      setSession({
        threadId: resumeData.threadId,
        currentStep: resumeData.currentStep ?? '',
      });

      // Resume meal plan if available
      if (resumeData.mealPlan?.days) {
        setMealPlan(convertGatewayMealPlan(resumeData.mealPlan));
      }

      // Resume shopping list if available
      if (resumeData.shoppingList) {
        const items = resumeData.shoppingList.map((i) => ({
          ingredient: i.ingredient ?? '',
          quantity: i.quantity ?? '',
          category: i.category ?? '',
        }));
        setShoppingList(items);
      }

      // Fetch messages from HTTP endpoint
      fetchAndUpdateMessages(resumeData.threadId);
    }
  }, [resumeData]);

  const fetchAndUpdateMessages = async (threadId: string) => {
    try {
      const messages = await getMessages(threadId);
      const formattedMessages: ChatMessage[] = messages.map((msg: any) => ({
        sender: msg.sender === 'user' ? 'user' : 'agent',
        text: msg.content || msg.message || '',
      }));
      setMessages(formattedMessages);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      // Fallback to empty messages if fetch fails
      setMessages([]);
    }
  };

  const sendMessage = async () => {
    if (!session || !input.trim()) return;
    const userMsg: ChatMessage = { sender: 'user', text: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsWorking(true);
    try {
      const result = await sendAgentMessage(
        session.threadId,
        userMsg.text,
        'user',
        true,
      );

      // Fetch messages from the HTTP endpoint after the agent has processed
      await fetchAndUpdateMessages(session.threadId);

      // fetch the latest checkpoint for meal plan state
      const checkpoint = await getAgentCheckpoint(session.threadId);
      if (!checkpoint || !checkpoint.state) {
        throw new Error('Failed to get agent checkpoint');
      }
      const state = checkpoint.state;

      // Update meal plan
      if (state.mealPlan) {
        const newPlan = convertGatewayMealPlan(state.mealPlan);
        setMealPlan(newPlan);
        applyHighlights(newPlan);
        try {
          const shoppingRes = await goGetShoppingList(newPlan);
          if (shoppingRes) {
            const items = (shoppingRes).map((i) => ({
              ingredient: i.ingredient ?? '',
              quantity: i.quantity ?? '',
              category: i.category ?? '',
            }));
            setShoppingList(items);
          }
        } catch (e) {
          console.error('Failed to fetch shopping list', e);
        }
      }

      // Check for meal plan in initial state
      if (result.initialState?.state?.mealPlan) {
        const plan = convertGatewayMealPlan(result.initialState.state.mealPlan);
        console.log('Applying highlights for new meal plan:', plan);
        applyHighlights(plan);
      }

      // Check for shopping list in initial state
      if (result.initialState?.mealPlan?.shoppingList) {
        setShoppingList(result.initialState.mealPlan.shoppingList);
      }
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setIsWorking(false);
    }
  };

  const copyMealPlan = () => {
    if (!mealPlan) return;
    const { html, text } = formatMealPlan(mealPlan);
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      });
      navigator.clipboard.write([item]);
    } catch (e) {
      navigator.clipboard.writeText(text);
    }
  };

  const copyShoppingList = () => {
    if (!shoppingList) return;
    const text = shoppingList
      .map((i) =>
        `- ${Number(i.quantity) > 0 ? `${i.quantity} ` : ''}${i.ingredient}`.trim(),
      )
      .join('\n');
    navigator.clipboard.writeText(text);
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  };

  const handleKeyPress: React.KeyboardEventHandler<HTMLDivElement> = (
    event,
  ) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleShareMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setShareMenuAnchor(event.currentTarget);
  };

  const handleShareMenuClose = () => {
    setShareMenuAnchor(null);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {showMealLibrary ? (
        <Box sx={{ position: 'relative', height: '100vh' }}>
          <MealManagementTab
            showToast={showToast}
            onClose={() => setShowMealLibrary(false)}
          />
        </Box>
      ) : (
        <Box sx={styles.mainContainer}>
          {/* Left Side - Chat */}
          <Paper
            elevation={0}
            sx={{ ...styles.chatContainer, boxShadow: 'none' }}
          >
            {/* Chat Header */}
            <Box sx={styles.chatHeader}>
              <RestaurantMenuIcon sx={{ mr: 2, color: colors.accent2 }} />
              <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                Meal Planner
              </Typography>

              {session ? (
                <Button
                  onClick={handleLogout}
                  size="small"
                  sx={{ color: colors.accent2 }}
                >
                  <ExitToAppIcon />
                </Button>
              ) : (
                <Button
                  onClick={startNewSession}
                  data-testid="start-session"
                  size="small"
                  sx={{ color: colors.apricot }}
                >
                  Start Session
                </Button>
              )}
              <Button
                onClick={() => setShowMealLibrary(true)}
                size="small"
                sx={{ color: colors.accent2 }}
                data-testid="open-meal-library"
              >
                <MenuBookIcon />
              </Button>
            </Box>
            <Box
              ref={chatRef}
              data-testid="chat-history"
              sx={styles.chatMessages}
            >
              {messages.length === 0 && !isWorking ? (
                <Box sx={styles.welcomeMessage}>
                  <RestaurantMenuIcon sx={styles.restaurantIcon} />
                  <Typography variant="h6" color="text.secondary">
                    Welcome to Meal Planning Assistant
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1, maxWidth: '500px' }}>
                    Start by telling me about your dietary preferences, and I'll
                    help you create a personalized meal plan.
                  </Typography>
                </Box>
              ) : (
                <>
                  {messages.map((message, index) => (
                    <Box
                      key={index}
                      sx={styles.messageContainer(message.sender === 'user')}
                    >
                      <Box
                        sx={styles.messageContent(message.sender === 'user')}
                      >
                        <Avatar sx={styles.avatar}>
                          {message.sender === 'agent' ? 'AI' : 'You'}
                        </Avatar>
                        <Box
                          sx={styles.messageBubble(message.sender === 'user')}
                        >
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
              )}
            </Box>

            {/* Chat Input */}
            <Box sx={styles.chatInputContainer}>
              <Box sx={styles.inputContainer}>
                <TextField
                  fullWidth
                  variant="outlined"
                  size="small"
                  placeholder="Type your message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isWorking}
                  inputProps={{ 'data-testid': 'message-input' }}
                />
                <Button
                  variant="contained"
                  data-testid="send-button"
                  onClick={sendMessage}
                  disabled={!input.trim() || isWorking}
                  sx={{
                    ...styles.sendButton,
                    backgroundColor: colors.apricot,
                    color: '#ffffff',
                    '&:hover': {
                      backgroundColor: '#ff9f2b',
                    },
                    '&:disabled': {
                      backgroundColor: '#cccccc',
                    },
                  }}
                >
                  Send
                </Button>
              </Box>
            </Box>
          </Paper>

          {/* Right Side - Meal Plan */}
          <Box sx={styles.mealPlanContainer}>
            <Paper
              elevation={0}
              sx={{ ...styles.mealPlanPaper, boxShadow: 'none' }}
            >
              {mealPlan || (shoppingList && shoppingList.length > 0) ? (
                <>
                  <Box sx={styles.sectionHeader}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        onClick={() => setCurrentTab(0)}
                        variant={currentTab === 0 ? 'contained' : 'outlined'}
                        size="small"
                        sx={{
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          borderRadius: '20px',
                          px: 2,
                          py: 0.5,
                          backgroundColor:
                            currentTab === 0 ? colors.accent2 : 'transparent',
                          borderColor: colors.accent2,
                          color: currentTab === 0 ? '#ffffff' : colors.accent2,
                          '&:hover': {
                            backgroundColor:
                              currentTab === 0
                                ? colors.accent2
                                : `${colors.accent2}10`,
                          },
                        }}
                      >
                        Meal Plan
                      </Button>
                      <Button
                        onClick={() => setCurrentTab(1)}
                        variant={currentTab === 1 ? 'contained' : 'outlined'}
                        size="small"
                        disabled={!shoppingList || shoppingList.length === 0}
                        sx={{
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          borderRadius: '20px',
                          px: 2,
                          py: 0.5,
                          backgroundColor:
                            currentTab === 1 ? colors.accent2 : 'transparent',
                          borderColor: colors.accent2,
                          color: currentTab === 1 ? '#ffffff' : colors.accent2,
                          '&:hover': {
                            backgroundColor:
                              currentTab === 1
                                ? colors.accent2
                                : `${colors.accent2}10`,
                          },
                          '&:disabled': {
                            borderColor: '#cccccc',
                            color: '#cccccc',
                          },
                        }}
                      >
                        Shopping List
                      </Button>
                    </Box>
                    <IconButton
                      onClick={handleShareMenuOpen}
                      size="small"
                      data-testid="share-menu-button"
                      sx={{
                        color: colors.accent2,
                        '&:hover': {
                          color: colors.accent,
                          backgroundColor: 'unset',
                        },
                      }}
                    >
                      <ShareIcon />
                    </IconButton>
                    <Menu
                      anchorEl={shareMenuAnchor}
                      open={Boolean(shareMenuAnchor)}
                      onClose={handleShareMenuClose}
                      sx={{
                        '& .MuiPaper-root': {
                          backgroundColor: colors.cardBg,
                        },
                      }}
                    >
                      {mealPlan && (
                        <MenuItem
                          onClick={() => {
                            copyMealPlan();
                            handleShareMenuClose();
                          }}
                          data-testid="copy-meal-plan"
                        >
                          Copy Meal Plan
                        </MenuItem>
                      )}
                      {shoppingList && shoppingList.length > 0 && (
                        <MenuItem
                          onClick={() => {
                            copyShoppingList();
                            handleShareMenuClose();
                          }}
                          data-testid="copy-shopping-list"
                        >
                          Copy Shopping List
                        </MenuItem>
                      )}
                    </Menu>
                  </Box>

                  {/* Tab Content */}
                  {currentTab === 0 && mealPlan && (
                    <MealPlanDisplay
                      plan={mealPlan}
                      highlights={highlights}
                      colors={colors}
                    />
                  )}

                  {currentTab === 1 &&
                    shoppingList &&
                    shoppingList.length > 0 && (
                      <Box sx={{ mt: 2, flex: 1, overflow: 'auto' }}>
                        <Box component="div" sx={{ p: 0, m: 0 }}>
                          {shoppingList.map((item, index) => (
                            <Box
                              component="div"
                              key={index}
                              sx={styles.shoppingListItem}
                            >
                              {Number(item.quantity) > 0
                                ? `${item.quantity} `
                                : ''}
                              {item.ingredient}
                              {item.category && ` (${item.category})`}
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    )}

                  {currentTab === 0 && !mealPlan && (
                    <Box sx={styles.emptyState}>
                      <RestaurantMenuIcon sx={styles.restaurantIcon} />
                      <Typography variant="h6" color="text.secondary">
                        No meal plan generated yet
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ mt: 1, maxWidth: '500px' }}
                      >
                        Start a conversation with the assistant to generate a
                        personalized meal plan.
                      </Typography>
                    </Box>
                  )}
                </>
              ) : (
                <Box sx={styles.emptyState}>
                  <RestaurantMenuIcon sx={styles.restaurantIcon} />
                  <Typography variant="h6" color="text.secondary">
                    No meal plan generated yet
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1, maxWidth: '500px' }}>
                    Start a conversation with the assistant to generate a
                    personalized meal plan.
                  </Typography>
                </Box>
              )}
            </Paper>
          </Box>
        </Box>
      )}
      <Toast message={toast} />
    </ThemeProvider>
  );
};

export default AgentPage;
