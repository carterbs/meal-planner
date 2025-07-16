import { useEffect, useState } from 'react';
import { createClient, createConfig } from '@mealplanner/generated/dist/gateway/client/index.js';
import { getCheckpointsByThreadId, postWorkflowsByThreadIdAbandon, postShoppinglist } from '@mealplanner/generated/dist/gateway/index.js';
import type { MainCheckpointResponse, MainMealPlanEntryResponse, MainShoppingListItemResponse } from '@mealplanner/generated/dist/gateway/types.gen';

// Create the API gateway client
const gatewayClient = createClient(createConfig({
  baseUrl: 'http://localhost:8080/api'
}));



// Shape of checkpoint.state
interface CheckpointState {
  currentStep?: string;
  mealPlan?: { days?: MainMealPlanEntryResponse[] };
  participants?: string[];
  threadId?: string;
}

export interface WorkflowState extends CheckpointState {
  threadId: string;
  shoppingList?: MainShoppingListItemResponse[];
  messages?: { content?: string; sender?: string }[];
} // include threadId, messages & optional shoppingList for resumeData


export default function useSession(startSession: () => Promise<void>) {
  const [isResuming, setIsResuming] = useState(false);
  const [resumeData, setResumeData] = useState<WorkflowState | undefined>();

  useEffect(() => {
    const id = localStorage.getItem('sessionId');
    if (!id) return;
    setIsResuming(true);
    getCheckpointsByThreadId({
      client: gatewayClient,
      path: { thread_id: id },
    })
      .then((result) => {
        if (!result.data || result.error) {
          return Promise.reject(result.error);
        }
        return result.data;
      })
      .then((cp) => {
        // Extract checkpoint state
        const state = cp.tuple?.checkpoint?.state;
        if (!state) {
          localStorage.removeItem('sessionId');
          return;
        }
        
        // Extract messages from checkpoint
        const messages = cp.tuple?.checkpoint?.messages?.map(msg => ({
          content: msg.content || '',
          sender: msg.sender || '',
        })) || [];
        
        const data: WorkflowState = { ...state, threadId: id, messages };
        setResumeData(data);
        // Fetch shopping list for resumed meal plan
        if (state.mealPlan) {
          postShoppinglist({ client: gatewayClient, body: { plan: state.mealPlan.days?.map(d => d.meal?.id ?? 0) ?? [] } })
            .then(res => {
              if (res.data && !res.error) {
                const items = res.data.items ?? [];
                setResumeData(prev => prev ? { ...prev, shoppingList: items } : prev);
              }
            })
            .catch(() => {
              // ignore shopping list errors
            });
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
        // ignore
      }
      localStorage.removeItem('sessionId');
    }
    await startSession();
  };

  return { isResuming, resumeData, startNewSession };
}
