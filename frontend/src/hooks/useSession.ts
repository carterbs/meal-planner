import { useState, useEffect, useCallback } from 'react';

export interface WorkflowState {
  threadId: string;
  workflow_type: string;
  current_step: string;
  status?: string;
}

export default function useSession() {
  const [isResuming, setIsResuming] = useState(false);
  const [resumeData, setResumeData] = useState<WorkflowState | undefined>();

  useEffect(() => {
    const id = localStorage.getItem('sessionId');
    if (!id) return;
    setIsResuming(true);
    fetch(`/api/workflows/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('failed');
        return r.json();
      })
      .then((wf: WorkflowState) => {
        if (wf.current_step !== 'complete' && wf.status !== 'ABANDONED') {
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

  const startNewSession = useCallback(async () => {
    const existing = localStorage.getItem('sessionId');
    if (existing) {
      try {
        await fetch(`/api/workflows/${existing}/abandon`, { method: 'POST' });
      } catch {
        // ignore network errors
      }
      localStorage.removeItem('sessionId');
    }

    const res = await fetch('/api/agent/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participants: ['user'], workflowType: 'meal_planning' })
    });
    const data = await res.json();
    localStorage.setItem('sessionId', data.threadId);
    return data;
  }, []);

  return { isResuming, resumeData, startNewSession } as const;
}
