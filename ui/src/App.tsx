import React, { useEffect, useRef, useState } from 'react';
import AgentPage from './AgentPage';
import Connecting from './components/Connecting';

const POLL_INTERVAL = 3000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseHealthServices(value: unknown): Record<string, boolean> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const servicesValue = value.services;
  if (!isRecord(servicesValue)) {
    return undefined;
  }
  const entries: Array<[string, boolean]> = [];
  for (const [key, raw] of Object.entries(servicesValue)) {
    entries.push([key, Boolean(raw)]);
  }
  return Object.fromEntries(entries);
}

const App: React.FC = () => {
  const [healthy, setHealthy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [services, setServices] = useState<Record<string, boolean> | undefined>();
  const pollRef = useRef<NodeJS.Timeout>();

  const checkHealth = async () => {
    setChecking(true);
    try {
      const response = await fetch('http://localhost:8090/api/health');
      if (!response.ok) {
        setHealthy(false);
        setChecking(false);
        return false;
      }

      const payload = (await response.json()) as unknown;
      const servicesResult = parseHealthServices(payload);
      setServices(servicesResult);
      const ok = servicesResult
        ? Object.values(servicesResult).every(Boolean)
        : false;
      setHealthy(ok);
      setChecking(false);
      return ok;
    } catch {
      // ignore
    }
    setHealthy(true);
    setChecking(false);
    return true;
  };

  useEffect(() => {
    void checkHealth();
    pollRef.current = setInterval(async () => {
      const ok = await checkHealth();
      if (ok && pollRef.current) {
        clearInterval(pollRef.current);
      }
    }, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  if (healthy) return <AgentPage />;
  if (checking) return <Connecting services={services} />;
  return <Connecting services={services} />;
};

export default App;
