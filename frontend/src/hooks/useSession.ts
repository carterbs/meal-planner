import { useEffect, useState } from "react";

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
    const id = localStorage.getItem("sessionId");
    if (!id) return;
    setIsResuming(true);
    fetch(`/api/workflows/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((wf: WorkflowState) => {
        if (
          wf.current_step &&
          wf.current_step.toLowerCase() !== "complete" &&
          wf.status !== "ABANDONED"
        ) {
          setResumeData(wf);
        } else {
          localStorage.removeItem("sessionId");
        }
      })
      .catch(() => {
        localStorage.removeItem("sessionId");
      })
      .finally(() => setIsResuming(false));
  }, []);

  const startNewSession = async () => {
    const existing = localStorage.getItem("sessionId");
    if (existing) {
      try {
        await fetch(`/api/workflows/${existing}/abandon`, { method: "POST" });
      } catch {
        // ignore
      }
      localStorage.removeItem("sessionId");
    }
    await startSession();
  };

  return { isResuming, resumeData, startNewSession };
}
