import { useEffect, useState } from 'react';
import { createClient, createConfig } from '@mealplanner/generated/gateway/client';
import { getCheckpointsByThreadId, postWorkflowsByThreadIdAbandon, postShoppinglist } from '@mealplanner/generated/gateway';
import type { GoShoppingList, GoGetCheckpointResponse, GoGetShoppingListResponse } from '@mealplanner/generated/gateway/types.gen';

// Create the API gateway client
const gatewayClient = createClient(
  createConfig({
    baseUrl: 'http://localhost:8090/api',
  }),
);

type MealPlanItemState = {
  mealId?: number | null;
  mealSnapshot?: unknown;
};

type LegacyMealPlanDay = {
  meal?: unknown;
};

// Shape of checkpoint.state
interface CheckpointState {
  currentStep?: string;
  mealPlan?: {
    items?: MealPlanItemState[];
    days?: LegacyMealPlanDay[];
  };
  participants?: string[];
  threadId?: string;
  shoppingList?: GoShoppingList;
}

export interface WorkflowState extends CheckpointState {
  threadId: string;
  shoppingList?: GoShoppingList;
} // include threadId & optional shoppingList for resumeData

function parseMealIdFromUnknown(value: unknown): number | undefined {
  if (value == null) {
    return undefined;
  }

  if (typeof value === 'number') {
    return value > 0 ? value : undefined;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as { id?: number };
      return typeof parsed.id === 'number' && parsed.id > 0 ? parsed.id : undefined;
    } catch {
      return undefined;
    }
  }

  if (typeof value === 'object') {
    const maybeId = (value as { id?: unknown }).id;
    if (typeof maybeId === 'number' && maybeId > 0) {
      return maybeId;
    }
    const nested = (value as { mealSnapshot?: unknown }).mealSnapshot;
    if (nested && nested !== value) {
      return parseMealIdFromUnknown(nested);
    }
  }

  return undefined;
}

function collectMealIdsFromItems(items: MealPlanItemState[] | undefined): number[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((item) => {
    if (typeof item.mealId === 'number') {
      return item.mealId;
    }
    const parsed = parseMealIdFromUnknown(item.mealSnapshot);
    return typeof parsed === 'number' ? parsed : 0;
  });
}

function collectMealIdsFromLegacyDays(days: LegacyMealPlanDay[] | undefined): number[] {
  if (!Array.isArray(days)) {
    return [];
  }
  return days.map((day) => {
    const parsed = parseMealIdFromUnknown(day.meal);
    return typeof parsed === 'number' ? parsed : 0;
  });
}

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
        const res = result as { data?: GoGetCheckpointResponse; error?: unknown };
        if (!res.data || res.error) {
          return Promise.reject(res.error);
        }
        return res.data;
      })
      .then((cp) => {
        // Handle case where the entire cp might be string-encoded
        let parsedCp: GoGetCheckpointResponse | undefined = cp;
        if (typeof cp === 'string') {
          parsedCp = JSON.parse(cp) as GoGetCheckpointResponse;
        }
        // parsedCp is defined when res.data exists

        // Handle case where tuple might be string-encoded
        let tuple = parsedCp.tuple as unknown;
        if (typeof tuple === 'string') {
          tuple = JSON.parse(tuple) as { checkpoint?: unknown };
        }

        // Extract checkpoint state
        const checkpointData = (tuple as { checkpoint?: unknown } | undefined)?.checkpoint;
        if (!checkpointData) return;

        // Handle case where checkpoint might be a string (from API response)
        const checkpoint =
          typeof checkpointData === 'string'
            ? (JSON.parse(checkpointData) as { state?: CheckpointState })
            : (checkpointData as { state?: CheckpointState });
        const state = checkpoint.state;
        if (!state) {
          localStorage.removeItem('sessionId');
          return;
        }

        const data: WorkflowState = {
          ...state,
          threadId: id,
          shoppingList: state.shoppingList,
        } as WorkflowState;
        setResumeData(data);
        // Fetch shopping list for resumed meal plan
        let mealIds = collectMealIdsFromItems(state.mealPlan?.items);
        if (mealIds.length === 0) {
          mealIds = collectMealIdsFromLegacyDays(state.mealPlan?.days);
        }
        if (mealIds.length > 0) {
          postShoppinglist({
            client: gatewayClient,
            body: {
              plan: mealIds,
            },
          })
            .then((res) => {
              const r = res as { data?: GoGetShoppingListResponse; error?: unknown };
              if (r.data && !r.error) {
                const items = r.data.items ?? [];
                setResumeData((prev) =>
                  prev ? { ...prev, shoppingList: { items } } : prev,
                );
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
