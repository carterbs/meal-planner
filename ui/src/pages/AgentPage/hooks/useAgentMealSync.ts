import { useCallback, useState } from 'react';
import { MealPlan, ShoppingListItem } from '@mealplanner/generated/api_pb';
import { convertGatewayMealPlan } from '../../../utils/mealPlanConverter';
import {
  getAgentCheckpoint,
  goGetShoppingList,
  sendAgentMessage,
} from '../../../api';
export default function useAgentMealSync() {
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[] | null>(
    null,
  );
  const [isSending, setIsSending] = useState(false);

  const syncFromCheckpoint = useCallback(async (threadId: string) => {
    const state = await getAgentCheckpoint(threadId);
    if (!state?.mealPlan) return;
    const newPlan = convertGatewayMealPlan(state.mealPlan);
    setMealPlan(newPlan);
    try {
      const shoppingRes = await goGetShoppingList(newPlan);
      setShoppingList(shoppingRes);
    } catch {
      // ignore
    }
  }, []);

  const send = useCallback(async (threadId: string, text: string) => {
    setIsSending(true);
    try {
      await sendAgentMessage(threadId, text, 'user', true);
    } finally {
      setIsSending(false);
    }
  }, []);

  return { mealPlan, shoppingList, syncFromCheckpoint, send, setMealPlan, isSending };
}
