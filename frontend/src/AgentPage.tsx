import React, { useState } from 'react';
import { Box, Button, TextField, List, ListItem, Typography } from '@mui/material';

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
  const [mealPlan, setMealPlan] = useState<any | null>(null);

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
      if (data.meal_plan) setMealPlan(data.meal_plan);
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
        body: JSON.stringify({ thread_id: session.threadId, message: userMsg.text, from: 'user' })
      });
      const res = await fetch('/api/agent/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id: session.threadId, interactive: false })
      });
      const data = await res.json();
      if (data.message) setMessages(prev => [...prev, { sender: 'agent', text: data.message }]);
      if (data.raw && data.raw.meal_plan) setMealPlan(data.raw.meal_plan);
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setIsWorking(false);
    }
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
        <pre data-testid="meal-plan">{JSON.stringify(mealPlan)}</pre>
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
