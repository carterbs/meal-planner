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
    const checkpoint = await getAgentCheckpoint(threadId);
    const state = checkpoint?.state;
    if (!state) return;
    const maybePlan = state.mealPlan;
    if (maybePlan) {
      const newPlan = convertGatewayMealPlan(maybePlan);
      setMealPlan(newPlan);
      try {
        const shoppingRes = await goGetShoppingList(newPlan);
        setShoppingList(
          shoppingRes.map(
            (i) =>
              new ShoppingListItem({
                ingredient: i.ingredient ?? '',
                quantity: i.quantity ?? '',
                category: i.category ?? '',
              }),
          ),
        );
      } catch {
        // ignore
      }
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
