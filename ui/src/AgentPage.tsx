import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import MealManagementPage from './pages/MealManagementPage/MealManagementPage';
import { Toast } from './components/Toast';
// types and API handled in hooks
// TypingIndicator is now rendered inside ChatMessages
import useSession from './hooks/useSession';

// no local style typings here; styles come from theme helpers
import {
  copyMealPlanToClipboard,
  copyShoppingListToClipboard,
} from './utils/clipboard';
import useMealPlanHighlights from './hooks/useMealPlanHighlights';
import useAutoScroll from './hooks/useAutoScroll';
import useAgentController from './pages/AgentPage/hooks/useAgentController';

// Removed unused gateway client

import { colorSchemes, getAgentPageStyles } from './agentTheme';
import ChatPanel from './pages/AgentPage/components/chat/ChatPanel';
import PlanPanel from './pages/AgentPage/components/plan/PlanPanel';

// Clipboard formatting now lives in utils/clipboard

const AgentPage: React.FC = () => {
  const {
    session,
    startSession,
    logout,
    input,
    setInput,
    isWorking,
    messages,
    sendMessage,
    mealPlan,
    shoppingList,
  } = useAgentController();
  const { highlights, applyHighlights } = useMealPlanHighlights(
    mealPlan,
    () => {},
  );
  const [currentTab, setCurrentTab] = React.useState(0);
  const [showMealLibrary, setShowMealLibrary] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const currentColorScheme = 'earthyNeutrals';
  const chatRef = useAutoScroll<HTMLDivElement>(messages.length);

  const colors = colorSchemes[currentColorScheme];
  const styles = useMemo(() => getAgentPageStyles(colors), [colors]);

  const { startNewSession } = useSession(startSession);
  const handleLogout = logout;

  // messages are handled by controller

  const handleSend = async () => {
    const res = await sendMessage();
    if (res?.newPlan) {
      applyHighlights(res.newPlan);
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
      void handleSend();
    }
  };

  // share menu handlers removed in favor of PlanPanel's internal menu

  return (
    <>
      {showMealLibrary ? (
        <Box sx={{ position: 'relative', height: '100vh' }}>
          <MealManagementPage
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
            onSend={handleSend}
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
