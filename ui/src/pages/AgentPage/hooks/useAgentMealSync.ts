import { useCallback, useState } from 'react';
import { WeeklyMealPlan, ShoppingListItem } from '@mealplanner/generated';
import { convertGatewayMealPlan } from '../../../utils/mealPlanConverter';
import { getAgentCheckpoint, goGetShoppingList, sendAgentMessage } from '../../../api';

export default function useAgentMealSync() {
  const [mealPlan, setMealPlan] = useState<WeeklyMealPlan | null>(null);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[] | null>(null);

  const syncFromCheckpoint = useCallback(async (threadId: string) => {
    const checkpoint = await getAgentCheckpoint(threadId);
    const state = checkpoint?.state;
    if (!state) return;
    if (state.mealPlan) {
      const newPlan = convertGatewayMealPlan(state.mealPlan);
      setMealPlan(newPlan);
      try {
        const shoppingRes = await goGetShoppingList(newPlan);
        if (shoppingRes) {
          setShoppingList(
            shoppingRes.map((i) => new ShoppingListItem({ ingredient: i.ingredient ?? '', quantity: i.quantity ?? '', category: i.category ?? '' })),
          );
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const send = useCallback(async (threadId: string, text: string) => {
    const result = await sendAgentMessage(threadId, text, 'user', true);
    // Also surface any initial state embedded in the message result
    const initial = (result as any)?.initialState?.state?.mealPlan;
    if (initial) {
      const plan = convertGatewayMealPlan(initial);
      setMealPlan(plan);
    }
    const sl = (result as any)?.initialState?.mealPlan?.shoppingList;
    if (sl) {
      setShoppingList(sl);
    }
  }, []);

  return { mealPlan, shoppingList, syncFromCheckpoint, send, setMealPlan };
}


