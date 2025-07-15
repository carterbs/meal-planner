import { useEffect, useState } from 'react';
import { createClient, createConfig } from '@mealplanner/generated/dist/gateway/client/index.js';
import { getWorkflowsByThreadId, postWorkflowsByThreadIdAbandon } from '@mealplanner/generated/dist/gateway/index.js';

// Create the API gateway client
const gatewayClient = createClient(createConfig({
  baseUrl: 'http://localhost:8080/api'
}));

export interface WorkflowState {
  threadId: string;
  workflow_type: string;
  current_step: string;
  status?: string;
  [key: string]: any;
}

export default function useSession(startSession: () => Promise<void>) {
  const [isResuming, setIsResuming] = useState(false);
  const [resumeData, setResumeData] = useState<WorkflowState | undefined>();

  useEffect(() => {
    const id = localStorage.getItem('sessionId');
    if (!id) return;
    setIsResuming(true);
    getWorkflowsByThreadId({
      client: gatewayClient,
      path: { thread_id: id },
    })
      .then((result) => {
        if (!result.data || result.error) {
          return Promise.reject(result.error);
        }
        return result.data;
      })
      .then((wf: WorkflowState) => {
        if (
          wf.current_step &&
          wf.current_step.toLowerCase() !== 'complete' &&
          wf.status !== 'ABANDONED'
        ) {
          setResumeData(wf);
        } else {
          localStorage.removeItem('sessionId');
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
          path: { thread_id: existing },
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
