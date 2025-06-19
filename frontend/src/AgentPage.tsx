import React, { useState } from 'react';
import { Box, Button, TextField, List, ListItem, Typography } from '@mui/material';
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

  const startSession = async () => {
    setIsWorking(true);
    try {
      const res = await fetch('/api/agent/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participants: ['user'], workflow_type: 'meal_planning' })
      });
      const data = await res.json();
      setSession({ threadId: data.threadId, currentStep: data.currentStep });
      const plan = data.raw?.meal_plan || data.initialState?.meal_plan || data.meal_plan;
      if (plan) setMealPlan(plan);
      if (data.raw?.shopping_list_formatted) setShoppingList(data.raw.shopping_list_formatted);
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
      if (data.raw && data.raw.meal_plan) setMealPlan(data.raw.meal_plan);
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

  return (
    <Box sx={{ p: 2 }}>
      <Button onClick={startSession} variant="contained" data-testid="start-session">Start New Session</Button>
      {session && (
        <Typography sx={{ mt: 2 }} data-testid="session-id">Session: {session.threadId}</Typography>
      )}
      <List data-testid="chat-history">
        {messages.map((m, i) => (
          <ListItem key={i}>{m.sender}: {m.text}</ListItem>
        ))}
      </List>
      {mealPlan && (
        <>
          <MealPlanDisplay plan={mealPlan} />
          <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
            <Button variant="outlined" onClick={copyMealPlan} data-testid="copy-meal-plan">Copy Meal Plan</Button>
            {shoppingList && <Button variant="outlined" onClick={copyShoppingList} data-testid="copy-shopping-list">Copy Shopping List</Button>}
          </Box>
        </>
      )}
      <TextField 
        value={input}
        onChange={e => setInput(e.target.value)}
        inputProps={{ 'data-testid': 'message-input' }}
      />
      <Button onClick={sendMessage} disabled={!session || !input} data-testid="send-button">Send</Button>
      {isWorking && <Typography data-testid="working">Working...</Typography>}
    </Box>
  );
};

export default AgentPage;
