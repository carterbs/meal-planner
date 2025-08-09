import { useCallback, useEffect, useRef, useState } from 'react';
import { startAgentSession, SessionInfo } from '../../../api';
import useSession from '../../../hooks/useSession';

export default function useAgentSession() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const start = useCallback(async () => {
    setIsWorking(true);
    try {
      const result = await startAgentSession(['user'], 'meal_planning');
      setSession(result.session);
      localStorage.setItem('sessionId', result.session.threadId);
      return result;
    } finally {
      setIsWorking(false);
    }
  }, []);

  // useSession expects a Promise<void> callback; adapt by ignoring the result
  const { resumeData, startNewSession } = useSession(async () => {
    await start();
  });
  const processedResumeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!resumeData || !resumeData.threadId) return;
    if (processedResumeRef.current === resumeData.threadId) return;
    processedResumeRef.current = resumeData.threadId;
    setSession({
      threadId: resumeData.threadId,
      currentStep: resumeData.currentStep ?? '',
    });
  }, [resumeData?.threadId]);

  const logout = useCallback(() => {
    setSession(null);
    startNewSession();
  }, [startNewSession]);

  return { session, isWorking, start, logout, resumeData } as const;
}
