import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  AppBar,
  Toolbar,
  Avatar,
  ThemeProvider,
  CssBaseline,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  createTheme,
} from '@mui/material';
import {
  RestaurantMenu as RestaurantMenuIcon,
  ExitToApp as ExitToAppIcon,
  ExpandMore as ExpandMoreIcon,
  ShoppingCart as ShoppingCartIcon,
} from '@mui/icons-material';
import MealPlanDisplay from './components/MealPlanDisplay';
import { ShoppingListItem } from './types';
import { WeeklyMealPlan } from '@mealplanner/generated';
import { startAgentSession, sendAgentMessage, getAgentCheckpoint, SessionInfo } from './api';
import TypingIndicator from './components/TypingIndicator';
import useSession from './hooks/useSession';
import type { WorkflowState } from './hooks/useSession';
import { createClient, createConfig } from '@mealplanner/generated/dist/gateway/client/index.js';
import { postShoppinglist } from '@mealplanner/generated/dist/gateway/index.js';

import type { SxProps, Theme } from '@mui/material';
import { DAYS_OF_THE_WEEK } from '@meal-planner/shared';
import type { DayOfTheWeek } from '@meal-planner/shared';

const gatewayClient = createClient(createConfig({
  baseUrl: 'http://localhost:8080/api'
}));
// Style variables
const styles = {
  appBar: {
    backgroundColor: 'primary.main',
    color: 'primary.contrastText',
  } as SxProps<Theme>,
  mainContainer: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  } as SxProps<Theme>,
  contentContainer: {
    display: 'flex',
    flexDirection: 'row',
    flex: 1,
    gap: 0,
    height: '100%',
    width: '100%',
    maxWidth: '100vw',
    overflow: 'hidden',
  } as SxProps<Theme>,
  chatContainer: {
    width: '35%',
    minWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 0,
    borderRight: (theme: Theme) => `1px solid ${theme.palette.divider}`,
    backgroundColor: 'background.paper',
  } as SxProps<Theme>,
  chatMessages: {
    flexGrow: 1,
    overflowY: 'auto',
    p: 2,
    display: 'flex',
    flexDirection: 'column',
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
      borderRadius: '18px',
      borderTopLeftRadius: isUser ? '18px' : '4px',
      borderTopRightRadius: isUser ? '4px' : '18px',
      bgcolor: isUser ? 'primary.main' : 'grey.100',
      color: isUser ? 'primary.contrastText' : 'text.primary',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
      position: 'relative',
      maxWidth: '100%',
      marginLeft: isUser ? 0 : '8px',
      marginRight: isUser ? '8px' : 0,
    }) as SxProps<Theme>,
  avatar: {
    width: 32,
    height: 32,
    bgcolor: 'grey.300',
    color: 'grey.700',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '4px',
  } as SxProps<Theme>,
  chatInputContainer: {
    p: 2,
    borderTop: (theme: Theme) => `1px solid ${theme.palette.divider}`,
    backgroundColor: 'background.paper',
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
    overflow: 'auto',
    p: 3,
    backgroundColor: 'background.default',
  } as SxProps<Theme>,
  mealPlanPaper: {
    p: 3,
    minHeight: '100%',
    backgroundColor: 'background.paper',
    borderRadius: 2,
  } as SxProps<Theme>,
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    mb: 3,
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
  } as SxProps<Theme>,
  shoppingListItem: {
    display: 'block',
    py: 0.25,
    pl: 0,
  } as SxProps<Theme>,
  checkbox: {
    marginRight: '8px',
  } as React.CSSProperties,
};

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
      default: '#f8f5ed', // Warm off-white
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h5: {
      fontWeight: 600,
      letterSpacing: '0.5px',
    },
    body1: {
      lineHeight: 1.6,
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
  const chatRef = useRef<HTMLDivElement | null>(null);

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
      if (result.initialState?.state?.mealPlan) {
        console.log(
          'Setting meal plan from session start:',
          result.initialState.state.mealPlan,
        );
        setMealPlan(result.initialState.state.mealPlan);
        setShoppingList(result.initialState.state.mealPlan.shoppingList);
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
      setSession({ threadId: resumeData.threadId, currentStep: resumeData.currentStep ?? '' });

      // Resume meal plan if available
      if (resumeData.mealPlan?.days) {
        setMealPlan(new WeeklyMealPlan({ days: resumeData.mealPlan.days }));
      }

      // Resume shopping list if available
      if (resumeData.shoppingList) {
        const items = resumeData.shoppingList.map(i => ({
          ingredient: i.ingredient ?? '',
          quantity: i.quantity ?? '',
          category: i.category ?? ''
        }));
        setShoppingList(items);
      }

      // Set all previous messages from the session
      if (resumeData.messages && Array.isArray(resumeData.messages)) {
        const formattedMessages: ChatMessage[] = resumeData.messages.map(
          (msg: any) => ({
            sender: msg.sender === 'user' ? 'user' : 'agent',
            text: msg.content ?? '',
          }),
        );
        setMessages(formattedMessages);
      }
    }
  }, [resumeData]);

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

      if (result.initialState?.state?.messages) {
        // render full conversation from checkpoint state
        const formatted: ChatMessage[] = result.initialState.state.messages.map((msg: any) => ({
          sender: msg.sender === 'user' ? 'user' : 'agent',
          text: msg.content ?? '',
        }));
        setMessages(formatted);
      } else if (result.message) {
        setMessages((prev) => [...prev, { sender: 'agent', text: result.message ?? '' }]);
      }
      // fetch the latest checkpoint
      const checkpoint = await getAgentCheckpoint(session.threadId);
      if (!checkpoint || !checkpoint.state) {
        throw new Error('Failed to get agent checkpoint');
      }
      const state = checkpoint.state;

      // Update messages from checkpoint
      if (checkpoint.messages && Array.isArray(checkpoint.messages)) {
        const formattedMessages: ChatMessage[] = checkpoint.messages.map(
          (msg: any) => ({
            sender: msg.sender === 'user' ? 'user' : 'agent',
            text: msg.content ?? '',
          }),
        );
        setMessages(formattedMessages);
      }

      // Update meal plan
      if (state.mealPlan) {
        const newPlan = new WeeklyMealPlan({ days: state.mealPlan.days ?? [] });
        setMealPlan(newPlan);
        applyHighlights(newPlan);
        try {
          const planIds = state.mealPlan.days?.map(d => d.meal?.id ?? 0) ?? [];
          const shoppingRes = await postShoppinglist({ client: gatewayClient, body: { plan: planIds } });
          if (shoppingRes.data && !shoppingRes.error) {
            const items = (shoppingRes.data.items ?? []).map(i => ({
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
        console.log(
          'Applying highlights for new meal plan:',
          result.initialState.state.mealPlan,
        );
        applyHighlights(result.initialState.state.mealPlan);
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

  const handleKeyPress: React.KeyboardEventHandler<HTMLDivElement> = (
    event,
  ) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={styles.mainContainer}>
        {/* Header */}
        <AppBar position="static" elevation={0} sx={styles.appBar}>
          <Toolbar>
            <RestaurantMenuIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Meal Planning Assistant
            </Typography>
            {session ? (
              <Button
                color="inherit"
                onClick={handleLogout}
                startIcon={<ExitToAppIcon />}
              >
                End Session
              </Button>
            ) : (
              <Button
                color="inherit"
                onClick={startNewSession}
                data-testid="start-session"
              >
                Start Session
              </Button>
            )}
          </Toolbar>
        </AppBar>

        <Box sx={styles.contentContainer}>
          {/* Left Side - Chat */}
          <Paper elevation={0} sx={styles.chatContainer}>
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
                  color="primary"
                  data-testid="send-button"
                  onClick={sendMessage}
                  disabled={!input.trim() || isWorking}
                  sx={styles.sendButton}
                >
                  Send
                </Button>
              </Box>
            </Box>
          </Paper>

          {/* Right Side - Meal Plan */}
          <Box sx={styles.mealPlanContainer}>
            <Paper elevation={0} sx={styles.mealPlanPaper}>
              {mealPlan ? (
                <>
                  <Box sx={styles.sectionHeader}>
                    <Typography variant="h5" sx={styles.sectionTitle}>
                      Weekly Meal Plan
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={copyMealPlan}
                        data-testid="copy-meal-plan"
                      >
                        Copy Plan
                      </Button>
                    </Box>
                  </Box>
                  <MealPlanDisplay plan={mealPlan} highlights={highlights} />

                  {/* Shopping List Accordion */}
                  {shoppingList && shoppingList.length > 0 && (
                    <Accordion
                      elevation={0}
                      sx={{
                        mt: 3,
                        '&:before': { display: 'none' },
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        overflow: 'hidden',
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                          bgcolor: 'grey.50',
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          '&.Mui-expanded': {
                            minHeight: '48px',
                            margin: 0,
                          },
                          '& .MuiAccordionSummary-content': {
                            margin: '12px 0',
                            '&.Mui-expanded': {
                              margin: '12px 0',
                            },
                          },
                        }}
                      >
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                          <ShoppingCartIcon fontSize="small" color="action" />
                          <Typography variant="subtitle1">
                            Shopping List
                          </Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ p: 0 }}>
                        <Box sx={{ p: 2, pt: 1 }}>
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'flex-end',
                              mb: 1,
                            }}
                          >
                            <Button
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyShoppingList();
                              }}
                              data-testid="copy-shopping-list"
                            >
                              Copy List
                            </Button>
                          </Box>
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
                      </AccordionDetails>
                    </Accordion>
                  )}
                </>
              ) : shoppingList && shoppingList.length > 0 ? (
                <>
                  <Box sx={styles.sectionHeader}>
                    <Typography variant="h5" sx={styles.sectionTitle}>
                      Shopping List
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={copyShoppingList}
                      data-testid="copy-shopping-list"
                    >
                      Copy List
                    </Button>
                  </Box>
                  <Box sx={{ mt: 2 }}>
                    <Box component="div" sx={{ p: 0, m: 0 }}>
                      {shoppingList.map((item, index) => (
                        <Box
                          component="div"
                          key={index}
                          sx={styles.shoppingListItem}
                        >
                          {Number(item.quantity) > 0 ? `${item.quantity} ` : ''}
                          {item.ingredient}
                          {item.category && ` (${item.category})`}
                        </Box>
                      ))}
                    </Box>
                  </Box>
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
      </Box>
    </ThemeProvider>
  );
};

export default AgentPage;
