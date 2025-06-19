import React, { useState, useRef, useEffect } from 'react';
import { Box, Button, TextField, Typography, Paper, Avatar, IconButton } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import MealPlanDisplay, { WeeklyMealPlan } from './components/MealPlanDisplay';

// Utility to format a WeeklyMealPlan for clipboard copying
const WEEK_DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function formatMealPlan(plan: WeeklyMealPlan): { html: string; text: string } {
  let html = '<table style="border-collapse: collapse; width: 100%;">';
  html += '<thead><tr>' +
          '<th style="border:1px solid #ddd;padding:8px;text-align:left;">Day</th>' +
          '<th style="border:1px solid #ddd;padding:8px;text-align:left;">Meals</th>' +
          '</tr></thead><tbody>';

  let text = 'Day | Meals\n';
  text += '----|------\n';

  WEEK_DAYS.forEach((day, idx) => {
    const entries = plan.days.filter(d => d.dayIndex === idx);
    if (entries.length === 0) return;

    const mealsHtml = entries.map(e => {
      const meal = e.meal;
      return `<strong>${e.mealType.charAt(0).toUpperCase()+e.mealType.slice(1)}</strong>: ${meal.name} (${meal.effort})`;
    }).join('<br>');
    html += `<tr><td style="border:1px solid #ddd;padding:8px;">${day}</td>` +
            `<td style="border:1px solid #ddd;padding:8px;">${mealsHtml}</td></tr>`;

    const mealsText = entries.map(e => {
      const meal = e.meal;
      return `${e.mealType}: ${meal.name} (${meal.effort})`;
    }).join('; ');
    text += `${day} | ${mealsText}\n`;
  });

  html += '</tbody></table>';
  return { html, text };
}

interface ChatMessage {
  sender: 'user' | 'agent';
  text: string;
}

interface SessionInfo {
  threadId: string;
  currentStep: string;
}

const AgentPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [mealPlan, setMealPlan] = useState<WeeklyMealPlan | null>(null);
  const [shoppingList, setShoppingList] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<Set<string>>(new Set());
  const chatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = chatRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const applyHighlights = (newPlan: WeeklyMealPlan) => {
    setHighlights(prev => {
      const changed = new Set<string>();
      if (mealPlan) {
        newPlan.days.forEach(d => {
          const prevEntry = mealPlan.days.find(p => p.dayIndex === d.dayIndex && p.mealType === d.mealType);
          if (!prevEntry || prevEntry.meal.id !== d.meal.id) {
            changed.add(`${d.dayIndex}-${d.mealType}`);
          }
        });
      }
      if (changed.size > 0) {
        setTimeout(() => {
          setHighlights(h => {
            const copy = new Set(h);
            changed.forEach(k => copy.delete(k));
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
      const res = await fetch('/api/agent/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participants: ['user'], workflowType: 'meal_planning' })
      });
      const data = await res.json();
      setSession({ threadId: data.threadId, currentStep: data.currentStep });
      
      // Extract meal plan from various possible locations in response
      const plan = data.initialState?.meal_plan || data.raw?.meal_plan || data.meal_plan;
      if (plan) {
        console.log('Setting meal plan from session start:', plan);
        setMealPlan(plan);
      }
      
      if (data.raw?.shopping_list_formatted || data.initialState?.shopping_list) {
        setShoppingList(data.raw?.shopping_list_formatted || data.initialState?.shopping_list);
      }
      if (data.message) setMessages([{ sender: 'agent', text: data.message }]);
    } catch (err) {
      console.error('Failed to start session', err);
    } finally {
      setIsWorking(false);
    }
  };

  const sendMessage = async () => {
    if (!session || !input.trim()) return;
    const userMsg: ChatMessage = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsWorking(true);
    try {
      await fetch('/api/agent/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: session.threadId, message: userMsg.text, from: 'user' })
      });
      const res = await fetch('/api/agent/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: session.threadId, interactive: false })
      });
      const data = await res.json();
      if (data.message) setMessages(prev => [...prev, { sender: 'agent', text: data.message }]);
      if (data.raw && data.raw.meal_plan) applyHighlights(data.raw.meal_plan);
      if (data.raw && data.raw.shopping_list_formatted) setShoppingList(data.raw.shopping_list_formatted);
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
        'text/plain': new Blob([text], { type: 'text/plain' })
      });
      navigator.clipboard.write([item]);
    } catch (e) {
      navigator.clipboard.writeText(text);
    }
  };

  const copyShoppingList = () => {
    if (!shoppingList) return;
    navigator.clipboard.writeText(shoppingList);
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Button onClick={startSession} variant="contained" data-testid="start-session">Start New Session</Button>
      {session && (
        <Typography data-testid="session-id">Session: {session.threadId}</Typography>
      )}
      <Box ref={chatRef} data-testid="chat-history" sx={{ flexGrow: 1, overflowY: 'auto', maxHeight: 300, display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
        {messages.map((m, i) => (
          <Box key={i} sx={{ display: 'flex', justifyContent: m.sender === 'user' ? 'flex-end' : 'flex-start' }}>
            <Paper sx={{ p: 1, maxWidth: '70%', backgroundColor: m.sender === 'user' ? '#eef4ea' : '#fff' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {m.sender === 'agent' && <Avatar sx={{ width: 24, height: 24 }}>A</Avatar>}
                <Typography variant="body2">{m.text}</Typography>
                {m.sender === 'user' && <Avatar sx={{ width: 24, height: 24 }}>U</Avatar>}
              </Box>
            </Paper>
          </Box>
        ))}
      </Box>
      {mealPlan && (
        <>
          <MealPlanDisplay plan={mealPlan} highlights={highlights} />
          <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
            <Button variant="outlined" onClick={copyMealPlan} data-testid="copy-meal-plan">Copy Meal Plan</Button>
            {shoppingList && <Button variant="outlined" onClick={copyShoppingList} data-testid="copy-shopping-list">Copy Shopping List</Button>}
          </Box>
        </>
      )}
      {session && (
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
          <TextField
            fullWidth
            multiline
            minRows={1}
            maxRows={4}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            inputProps={{ 'data-testid': 'message-input' }}
          />
          <IconButton color="primary" onClick={sendMessage} disabled={!input.trim()} data-testid="send-button">
            <SendIcon />
          </IconButton>
        </Box>
      )}
      {isWorking && <Typography data-testid="working">Working...</Typography>}
    </Box>
  );
};

export default AgentPage;
