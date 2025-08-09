import React, { useEffect, useRef, useState } from 'react';
import AgentPage from './AgentPage';
import Connecting from './components/Connecting';
import {
  createClient,
  createConfig,
} from '@mealplanner/generated/dist/gateway/client/index.js';
import { getHealth } from '@mealplanner/generated/dist/gateway/sdk.gen';

const gatewayClient = createClient(
  createConfig({
    baseUrl: 'http://localhost:8090/api',
  }),
);

const POLL_INTERVAL = 3000;

const App: React.FC = () => {
  const [healthy, setHealthy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [services, setServices] = useState<
    Record<string, boolean> | undefined
  >();
  const pollRef = useRef<NodeJS.Timeout>();

  const checkHealth = async () => {
    setChecking(true);
    try {
      const result = await getHealth({ client: gatewayClient });
      if (result.error) {
        setServices((result.error as any).services);
        const ok = Object.values((result.error as any).services || {}).every(
          Boolean,
        );
        setHealthy(ok);
        setChecking(false);
        return ok;
      }
    } catch {
      // ignore
    }
    setHealthy(true);
    setChecking(false);
    return true;
  };

  useEffect(() => {
    checkHealth();
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
