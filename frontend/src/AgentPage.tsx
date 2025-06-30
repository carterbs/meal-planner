import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Avatar,
  IconButton,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import MealPlanDisplay, { WeeklyMealPlan } from "./components/MealPlanDisplay";
import { ShoppingListItem } from "./types";
import TypingIndicator from "./components/TypingIndicator";
import useSession from "./hooks/useSession";

// Utility to format a WeeklyMealPlan for clipboard copying
const WEEK_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
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
      if (resumeData.message)
        setMessages([{ sender: "agent", text: resumeData.message }]);
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
      .map((i) => `- ${[i.quantity, i.ingredient].join(" ").trim()}`)
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
    <Box
      sx={{
        display: "flex",
        height: "calc(100vh - 64px)", // Adjust based on your header height
        width: "100%",
        overflow: "hidden",
      }}
    >
      {/* Left Side - Chat (1/3) */}
      <Box
        sx={{
          width: "33.33%",
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid #e0e0e0",
          p: 2,
          gap: 2,
          height: "100%",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Button
            size="small"
            variant="contained"
            onClick={startNewSession}
            data-testid="start-session"
          >
            {session ? "New Session" : "Start"}
          </Button>
          {session && (
            <Typography
              variant="caption"
              data-testid="session-id"
              sx={{
                fontFamily: "monospace",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "70%",
              }}
            >
              {session.threadId}
            </Typography>
          )}
        </Box>
        <Box
          ref={chatRef}
          data-testid="chat-history"
          sx={{
            flexGrow: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 1,
            pr: 1,
            "&::-webkit-scrollbar": {
              width: "6px",
            },
            "&::-webkit-scrollbar-track": {
              background: "#f1f1f1",
              borderRadius: "3px",
            },
            "&::-webkit-scrollbar-thumb": {
              background: "#888",
              borderRadius: "3px",
            },
            "&::-webkit-scrollbar-thumb:hover": {
              background: "#555",
            },
          }}
        >
          {messages.map((m, i) => (
            <Box
              key={i}
              sx={{
                display: "flex",
                justifyContent: m.sender === "user" ? "flex-end" : "flex-start",
              }}
            >
              <Paper
                sx={{
                  p: 1,
                  maxWidth: "70%",
                  backgroundColor: m.sender === "user" ? "#eef4ea" : "#fff",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {m.sender === "agent" && (
                    <Avatar sx={{ width: 24, height: 24 }}>A</Avatar>
                  )}
                  <Typography variant="body2">{m.text}</Typography>
                  {m.sender === "user" && (
                    <Avatar sx={{ width: 24, height: 24 }}>U</Avatar>
                  )}
                </Box>
              </Paper>
            </Box>
          ))}
          {isWorking && <TypingIndicator />}
        </Box>

        {session && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              pt: 1,
              borderTop: "1px solid #f0f0f0",
            }}
          >
            <TextField
              fullWidth
              multiline
              minRows={1}
              maxRows={4}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              inputProps={{ "data-testid": "message-input" }}
              size="small"
              placeholder="Type your message..."
              variant="outlined"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "20px",
                  backgroundColor: "#f5f5f5",
                  "&:hover": {
                    backgroundColor: "#eeeeee",
                  },
                  "&.Mui-focused": {
                    backgroundColor: "#fff",
                    boxShadow: "0 0 0 2px rgba(25, 118, 210, 0.2)",
                  },
                },
              }}
            />
            <IconButton
              color="primary"
              onClick={sendMessage}
              disabled={!input.trim() || isWorking}
              data-testid="send-button"
              sx={{
                backgroundColor: "primary.main",
                color: "white",
                "&:hover": {
                  backgroundColor: "primary.dark",
                },
                "&:disabled": {
                  backgroundColor: "#e0e0e0",
                  color: "#9e9e9e",
                },
              }}
            >
              <SendIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
      </Box>

      {/* Right Side - Meal Plan (2/3) */}
      <Box
        sx={{
          flex: 1,
          p: 3,
          overflowY: "auto",
          backgroundColor: "#fafafa",
          "&::-webkit-scrollbar": {
            width: "6px",
          },
          "&::-webkit-scrollbar-track": {
            background: "#f1f1f1",
            borderRadius: "3px",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "#888",
            borderRadius: "3px",
          },
          "&::-webkit-scrollbar-thumb:hover": {
            background: "#555",
          },
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
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6">Shopping List</Typography>
                  <ul>
                    {shoppingList.map((i, idx) => (
                      <li key={idx}>
                        {`${i.quantity} ${i.ingredient}`.trim()}
                      </li>
                    ))}
                  </ul>
                </Box>
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
  );
};

export default AgentPage;
