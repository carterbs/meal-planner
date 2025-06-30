import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Avatar,
  IconButton,
  AppBar,
  Toolbar,
  Container,
  CssBaseline,
  createTheme,
  ThemeProvider,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SendIcon from "@mui/icons-material/Send";
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import MealPlanDisplay, { WeeklyMealPlan } from "./components/MealPlanDisplay";
import { ShoppingListItem } from "./types";
import TypingIndicator from "./components/TypingIndicator";
import useSession from "./hooks/useSession";

// Custom theme with earthy colors
const theme = createTheme({
  palette: {
    primary: {
      main: '#6b8c5d',  // Sage green
      light: '#8baa7d',
      dark: '#4a5e40',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#8b7355',  // Warm brown
      light: '#b39f86',
      dark: '#5f4a2f',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f8f5ed',  // Warm off-white
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
const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];
function formatMealPlan(plan: WeeklyMealPlan): { html: string; text: string } {
  let html = '<table style="border-collapse: collapse; width: 100%;">';
  html +=
    "<thead><tr>" +
    '<th style="border:1px solid #ddd;padding:8px;text-align:left;">Day</th>' +
    '<th style="border:1px solid #ddd;padding:8px;text-align:left;">Meals</th>' +
    "</tr></thead><tbody>";

  let text = "Day | Meals\n";
  text += "----|------\n";

  WEEK_DAYS.forEach((day, idx) => {
    const entries = plan.days.filter((d) => d.dayIndex === idx);
    if (entries.length === 0) return;

    const mealsHtml = entries
      .filter((e) => e.meal)
      .map((e) => {
        const meal = e.meal!;
        return `<strong>${e.mealType.charAt(0).toUpperCase() + e.mealType.slice(1)}</strong>: ${meal.name} (${meal.effort})`;
      })
      .join("<br>");
    html +=
      `<tr><td style="border:1px solid #ddd;padding:8px;">${day}</td>` +
      `<td style="border:1px solid #ddd;padding:8px;">${mealsHtml}</td></tr>`;

    const mealsText = entries
      .filter((e) => e.meal)
      .map((e) => {
        const meal = e.meal!;
        return `${e.mealType}: ${meal.name} (${meal.effort})`;
      })
      .join("; ");
    text += `${day} | ${mealsText}\n`;
  });

  html += "</tbody></table>";
  return { html, text };
}

interface ChatMessage {
  sender: "user" | "agent";
  text: string;
}

interface SessionInfo {
  threadId: string;
  currentStep: string;
}

const AgentPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
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
      const res = await fetch("/api/agent/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participants: ["user"],
          workflowType: "meal_planning",
        }),
      });
      const data = await res.json();
      setSession({ threadId: data.threadId, currentStep: data.currentStep });
      localStorage.setItem("sessionId", data.threadId);

      // Extract meal plan from various possible locations in response
      const plan =
        data.initialState?.meal_plan || data.raw?.meal_plan || data.meal_plan;
      if (plan) {
        console.log("Setting meal plan from session start:", plan);
        setMealPlan(plan);
      }

      const list =
        data.shopping_list ||
        data.raw?.shopping_list ||
        data.initialState?.shopping_list;
      if (list) {
        setShoppingList(list);
      }
      if (data.message) setMessages([{ sender: "agent", text: data.message }]);
    } catch (err) {
      console.error("Failed to start session", err);
    } finally {
      setIsWorking(false);
    }
  };

  const { isResuming, resumeData, startNewSession } = useSession(startSession);

  useEffect(() => {
    if (resumeData) {
      setSession({
        threadId: resumeData.threadId,
        currentStep: resumeData.current_step,
      });
      const plan =
        resumeData.initialState?.meal_plan ||
        resumeData.raw?.meal_plan ||
        resumeData.meal_plan;
      if (plan) {
        setMealPlan(plan);
      }
      const list =
        resumeData.shopping_list ||
        resumeData.raw?.shopping_list ||
        resumeData.initialState?.shopping_list;
      if (list) setShoppingList(list as ShoppingListItem[]);
      
      // Set all previous messages from the session
      if (resumeData.messages && Array.isArray(resumeData.messages)) {
        const formattedMessages: ChatMessage[] = resumeData.messages.map(msg => ({
          sender: msg.sender === 'user' ? 'user' as const : 'agent' as const,
          text: msg.message
        }));
        setMessages(formattedMessages);
      } else if (resumeData.message) {
        // Fallback to single message if messages array is not available
        setMessages([{ sender: "agent" as const, text: resumeData.message }]);
      }
    }
  }, [resumeData]);

  const sendMessage = async () => {
    if (!session || !input.trim()) return;
    const userMsg: ChatMessage = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsWorking(true);
    try {
      const res = await fetch("/api/agent/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: session.threadId,
          message: userMsg.text,
          from: "user",
          interactive: false,
        }),
      });
      const data = await res.json();
      if (data.message)
        setMessages((prev) => [
          ...prev,
          { sender: "agent", text: data.message },
        ]);

      // Check for meal plan in both top level and raw
      const newMealPlan = data.meal_plan || data.raw?.meal_plan;
      if (newMealPlan) {
        console.log("Applying highlights for new meal plan:", newMealPlan);
        applyHighlights(newMealPlan);
      }

      // Check for shopping list in both locations
      const newShoppingList = data.shopping_list || data.raw?.shopping_list;
      if (newShoppingList) setShoppingList(newShoppingList);
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setIsWorking(false);
    }
  };

  const copyMealPlan = () => {
    if (!mealPlan) return;
    const { html, text } = formatMealPlan(mealPlan);
    try {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      });
      navigator.clipboard.write([item]);
    } catch (e) {
      navigator.clipboard.writeText(text);
    }
  };

  const copyShoppingList = () => {
    if (!shoppingList) return;
    const text = shoppingList
      .map((i) => `- ${Number(i.quantity) > 0 ? `${i.quantity} ` : ''}${i.ingredient}`.trim())
      .join("\n");
    navigator.clipboard.writeText(text);
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
        }}
      >
        <AppBar position="static" elevation={0} sx={{ backgroundColor: '#9caf88' }}>
          <Toolbar disableGutters sx={{ px: 3 }}>
            <RestaurantMenuIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
              Meal Planning Assistant
            </Typography>
            {session && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography
                  variant="caption"
                  data-testid="session-id"
                  sx={{
                    fontFamily: 'monospace',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 0,
                    color: '#2c3e22',
                    fontSize: '0.7rem',
                    maxWidth: '200px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    borderBottom: '1px solid rgba(44, 62, 34, 0.3)',
                  }}
                  title={session.threadId}
                >
                  Session: {session.threadId.substring(0, 8)}...
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={startNewSession}
                  data-testid="start-session"
                  startIcon={<ExitToAppIcon />}
                  sx={{
                    color: '#2c3e22',
                    borderColor: 'rgba(44, 62, 34, 0.5)',
                    '&:hover': {
                      backgroundColor: 'rgba(44, 62, 34, 0.1)',
                      borderColor: '#2c3e22',
                    },
                  }}
                >
                  New Session
                </Button>
              </Box>
            )}
          </Toolbar>
        </AppBar>
        
        <Container maxWidth="lg" sx={{ py: 3, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              flex: 1,
              gap: 2,
              height: 'calc(100vh - 150px)',
            }}
          >
            {/* Left Side - Chat (1/3) */}
            <Paper
              elevation={0}
              sx={{
                width: '35%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 2,
                overflow: 'hidden',
                backgroundColor: 'background.paper',
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  flexGrow: 1,
                }}
              >
                <Box
                  ref={chatRef}
                  data-testid="chat-history"
                  sx={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    '&::-webkit-scrollbar': {
                      width: '6px',
                    },
                    '&::-webkit-scrollbar-track': {
                      background: 'transparent',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      background: theme.palette.grey[300],
                      borderRadius: '3px',
                    },
                    '&::-webkit-scrollbar-thumb:hover': {
                      background: theme.palette.grey[400],
                    },
                  }}
                >
                  {messages.length === 0 && !isWorking ? (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      color: 'text.secondary',
                      textAlign: 'center',
                      p: 4,
                    }}
                  >
                    <RestaurantMenuIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
                    <Typography variant="h6" color="text.secondary">Welcome to Meal Planning Assistant</Typography>
                    <Typography variant="body2" sx={{ mt: 1, maxWidth: '500px' }}>
                      Start by telling me about your dietary preferences, and I'll help you create a personalized meal plan.
                    </Typography>
                  </Box>
                ) : (
                  <>
                    {messages.map((m, i) => (
                      <Box
                        key={i}
                        sx={{
                          display: "flex",
                          justifyContent: m.sender === "user" ? "flex-end" : "flex-start",
                          animation: 'fadeIn 0.3s ease-out',
                          '@keyframes fadeIn': {
                            '0%': { opacity: 0, transform: 'translateY(10px)' },
                            '100%': { opacity: 1, transform: 'translateY(0)' },
                          },
                        }}
                      >
                        <Paper
                          elevation={0}
                          sx={{
                            p: 2,
                            maxWidth: '90%',
                            backgroundColor: m.sender === "user" ? '#6b8c5d' : '#f8f5ed',
                            color: m.sender === "user" ? 'white' : '#2c3e22',
                            borderRadius: m.sender === "user" ? '18px 18px 0 18px' : '18px 18px 18px 0',
                            border: m.sender === "user" ? 'none' : '1px solid #e0d6b5',
                            boxShadow: m.sender === "user" ? '0 1px 2px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.05)',
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            {m.sender === "agent" && (
                              <Avatar 
                                sx={{ 
                                  width: 32, 
                                  height: 32, 
                                  bgcolor: '#8b7355',
                                  color: '#fff',
                                  fontSize: '0.875rem',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                }}
                              >
                                AI
                              </Avatar>
                            )}
                            <Typography variant="body2" sx={{ lineHeight: 1.5, display: 'flex', alignItems: 'center', minHeight: '32px' }}>
                              {m.text}
                            </Typography>
                            {m.sender === "user" && (
                              <Avatar 
                                sx={{ 
                                  width: 32, 
                                  height: 32, 
                                  bgcolor: 'white',
                                  color: theme.palette.primary.main,
                                  fontSize: '0.875rem',
                                }}
                              >
                                You
                              </Avatar>
                            )}
                          </Box>
                        </Paper>
                      </Box>
                    ))}
                    {isWorking && <TypingIndicator />}
                  </>
                )}
                {/* Chat Input */}
                <Box
                  sx={{
                    p: 2,
                    backgroundColor: 'background.paper',
                    borderTop: `1px solid ${theme.palette.divider}`,
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <TextField
                      variant="outlined"
                      size="small"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type a message..."
                      sx={{ width: "100%" }}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      onClick={sendMessage}
                      data-testid="send-message"
                      startIcon={<SendIcon />}
                      sx={{
                        backgroundColor: '#6b8c5d',
                        '&:hover': {
                          backgroundColor: '#5a7850',
                        },
                      }}
                    >
                      Send
                    </Button>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Paper>
          {/* Right Side - Meal Plan */}
          <Box
            sx={{
              width: "65%",
              display: "flex",
              flexDirection: "column",
              borderLeft: "1px solid #e0e0e0",
              p: 2,
              gap: 2,
              height: "100%",
              overflow: "hidden",
            }}
          >
              <Box
                sx={{
                  backgroundColor: "white",
                  borderRadius: 2,
                  p: 3,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  maxWidth: "100%",
                  overflowX: "auto",
                }}
              >
                {mealPlan ? (
                  <>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 3,
                      }}
                    >
                      <Typography
                        variant="h5"
                        sx={{ fontWeight: 600, color: "#333" }}
                      >
                        Weekly Meal Plan
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={copyMealPlan}
                          data-testid="copy-meal-plan"
                        >
                          Copy Plan
                        </Button>
                        {shoppingList && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={copyShoppingList}
                            data-testid="copy-shopping-list"
                          >
                            Shopping List
                          </Button>
                        )}
                      </Box>
                    </Box>
                    <MealPlanDisplay plan={mealPlan} highlights={highlights} />
                    {shoppingList && shoppingList.length > 0 && (
                      <Accordion 
                        elevation={0}
                        sx={{ 
                          mt: 2,
                          backgroundColor: 'transparent',
                          '&:before': {
                            display: 'none',
                          },
                        }}
                      >
                        <AccordionSummary
                          expandIcon={<ExpandMoreIcon />}
                          aria-controls="shopping-list-content"
                          id="shopping-list-header"
                          sx={{
                            minHeight: '48px',
                            '& .MuiAccordionSummary-content': {
                              margin: '8px 0',
                            },
                          }}
                        >
                          <Typography variant="h6" sx={{ color: 'text.primary' }}>Shopping List</Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ pt: 0, pb: 2 }}>
                          <Box 
                            component="ul" 
                            sx={{
                              listStyle: 'none',
                              p: 0,
                              m: 0,
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                              gap: 1,
                            }}
                          >
                            {shoppingList.map((i, idx) => (
                              <Box 
                                key={idx} 
                                component="li"
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  p: 1,
                                  borderRadius: 1,
                                  backgroundColor: 'rgba(0,0,0,0.02)',
                                  '&:hover': {
                                    backgroundColor: 'rgba(0,0,0,0.04)',
                                  },
                                }}
                              >
                                <Typography variant="body2">
                                  {Number(i.quantity) > 0 ? `${i.quantity} ` : ''}{i.ingredient}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        </AccordionDetails>
                      </Accordion>
                    )}
                  </>
                ) : (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      py: 8,
                      color: "#757575",
                    }}
                  >
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      No meal plan yet
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ textAlign: "center", maxWidth: "80%" }}
                    >
                      Start a conversation with the assistant to generate your
                      personalized meal plan.
                    </Typography>
                  </Box>
                )}

              </Box>
            </Box>
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
};

export default AgentPage;
