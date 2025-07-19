import React, { useEffect, useRef, useState } from 'react';
import AgentPage from './AgentPage';
import Connecting from './components/Connecting';
import { DatabaseConnectionError } from './components/DatabaseConnectionError';
import {
  createClient,
  createConfig,
} from '@mealplanner/generated/dist/gateway/client/index.js';
import {
  getHealth,
  postReconnect,
} from '@mealplanner/generated/dist/gateway/sdk.gen';

const gatewayClient = createClient(
  createConfig({
    baseUrl: 'http://localhost:8080/api',
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
    try {
      const result = await getHealth({ client: gatewayClient });
      if (result.data && !result.error) {
        setServices(result.data.services);
        const ok = Object.values(result.data.services || {}).every(Boolean);
        setHealthy(ok);
        setChecking(false);
        return ok;
      }
    } catch {
      // ignore
    }
    setHealthy(false);
    setChecking(false);
    return false;
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

  const handleRetry = async () => {
    await postReconnect({ client: gatewayClient });
    setChecking(true);
    await checkHealth();
  };

  if (healthy) return <AgentPage />;
  if (checking) return <Connecting services={services} />;
  return <DatabaseConnectionError onRetry={handleRetry} services={services} />;
};

export default App;
