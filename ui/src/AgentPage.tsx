import React, { useState, useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import { MealManagementTab } from './components/MealManagementTab';
import { Toast } from './components/Toast';
import { ShoppingListItem } from '@mealplanner/generated';
import { WeeklyMealPlan } from '@mealplanner/generated';
import {
  startAgentSession,
  sendAgentMessage,
  getAgentCheckpoint,
  getMessages,
  SessionInfo,
  goGetShoppingList,
} from './api';
// TypingIndicator is now rendered inside ChatMessages
import useSession from './hooks/useSession';

// no local style typings here; styles come from theme helpers
import { convertGatewayMealPlan } from './utils/mealPlanConverter';
import { copyMealPlanToClipboard, copyShoppingListToClipboard } from './utils/clipboard';
import useMealPlanHighlights from './hooks/useMealPlanHighlights';

// Removed unused gateway client

import { colorSchemes, getAgentPageStyles } from './theme';
import ChatPanel from './pages/AgentPage/components/chat/ChatPanel';
import PlanPanel from './pages/AgentPage/components/plan/PlanPanel';

// Clipboard formatting now lives in utils/clipboard

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
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[] | null>(null);
  const { highlights, applyHighlights } = useMealPlanHighlights(mealPlan, (p) => setMealPlan(p));
  const [currentTab, setCurrentTab] = useState(0);
  // Share menu now handled inside PlanPanel
  const [showMealLibrary, setShowMealLibrary] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const currentColorScheme = 'earthyNeutrals';
  const chatRef = useRef<HTMLDivElement | null>(null);

  const colors = colorSchemes[currentColorScheme];
  const styles = getAgentPageStyles(colors);

  useEffect(() => {
    const el = chatRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const startSession = async () => {
    setIsWorking(true);
    try {
      const result = await startAgentSession(['user'], 'meal_planning');
      setSession(result.session);
      localStorage.setItem('sessionId', result.session.threadId);

      // Extract meal plan from initial state
      if (result.initialState?.mealPlan) {
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
      if (resumeData.shoppingList?.items) {
        const items = resumeData.shoppingList.items.map((i) =>
          new ShoppingListItem({
            ingredient: i.ingredient ?? '',
            quantity: i.quantity ?? '',
            category: i.category ?? '',
          })
        );
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
        applyHighlights(newPlan);
        try {
          const shoppingRes = await goGetShoppingList(newPlan);
          if (shoppingRes) {
            const items = (shoppingRes).map((i) =>
              new ShoppingListItem({
                ingredient: i.ingredient ?? '',
                quantity: i.quantity ?? '',
                category: i.category ?? '',
              })
            );
            setShoppingList(items);
          }
        } catch (e) {
          console.error('Failed to fetch shopping list', e);
        }
      }

      // Check for meal plan in initial state
      if (result.initialState?.state?.mealPlan) {
        const plan = convertGatewayMealPlan(result.initialState.state.mealPlan);
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
    void copyMealPlanToClipboard(mealPlan);
  };

  const copyShoppingList = () => {
    if (!shoppingList) return;
    void copyShoppingListToClipboard(shoppingList);
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

  const _handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  // share menu handlers removed in favor of PlanPanel's internal menu

  return (
    <>
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
          <ChatPanel
            ref={chatRef}
            hasSession={!!session}
            isWorking={isWorking}
            messages={messages}
            input={input}
            onInputChange={setInput}
            onSend={sendMessage}
            onStartSession={startNewSession}
            onLogout={handleLogout}
            onOpenMealLibrary={() => setShowMealLibrary(true)}
            onEnterKey={handleKeyPress}
            colors={colors}
          />

          {/* Right Side - Meal Plan */}
          <PlanPanel
            mealPlan={mealPlan}
            shoppingList={shoppingList}
            currentTab={currentTab}
            onTabChange={setCurrentTab}
            highlights={highlights}
            onCopyMealPlan={copyMealPlan}
            onCopyShoppingList={copyShoppingList}
            colors={colors}
          />
        </Box>
      )}
      <Toast message={toast} />
    </>
  );
};

export default AgentPage;
