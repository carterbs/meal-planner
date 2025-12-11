import { useEffect, useState } from 'react';
import {
  createClient,
  createConfig,
} from '@mealplanner/generated/gateway/client';
import { postWorkflowsByThreadIdAbandon } from '@mealplanner/generated/gateway';
import { MealPlanningCheckpointState } from '@mealplanner/generated/api_pb';
import { getAgentCheckpoint, goGetShoppingList } from '../api';
import { toShoppingList } from '../utils/gatewayGuards';

const gatewayClient = createClient(
  createConfig({
    baseUrl: 'http://localhost:8090/api',
  }),
);

export type WorkflowState = MealPlanningCheckpointState;

export default function useSession(startSession: () => Promise<void>) {
  const [isResuming, setIsResuming] = useState(false);
  const [resumeData, setResumeData] = useState<WorkflowState | undefined>();

  useEffect(() => {
    const id = localStorage.getItem('sessionId');
    if (!id) return;

    setIsResuming(true);
    getAgentCheckpoint(id)
      .then(async (state) => {
        if (!state) {
          localStorage.removeItem('sessionId');
          return;
        }

        if (!state.threadId) {
          state.threadId = id;
        }

        setResumeData(state);

        if (!state.mealPlan) {
          return;
        }

        try {
          const items = await goGetShoppingList(state.mealPlan);
          if (items.length === 0) {
            return;
          }

          setResumeData((prev) => {
            if (!prev) {
              return prev;
            }
            const updated = new MealPlanningCheckpointState(prev);
            const shoppingList = toShoppingList(items);
            if (shoppingList) {
              updated.shoppingList = shoppingList;
            }
            return updated;
          });
        } catch {
          // Ignore shopping list errors when resuming a session
        }
      })
      .catch(() => {
        localStorage.removeItem('sessionId');
      })
      .finally(() => setIsResuming(false));
  }, []);

  const startNewSession = async () => {
    const existing = localStorage.getItem('sessionId');
    if (existing) {
      try {
        await postWorkflowsByThreadIdAbandon({
          client: gatewayClient,
          path: { threadId: existing },
        });
      } catch {
        // Ignore abandon failures when resetting the session
      }
      localStorage.removeItem('sessionId');
    }

    await startSession();
  };

  return { isResuming, resumeData, startNewSession };
}
