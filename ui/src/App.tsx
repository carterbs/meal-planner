import React, { useEffect, useRef, useState } from 'react';
import AgentPage from './AgentPage';
import Connecting from './components/Connecting';
import { createClient, createConfig } from '@mealplanner/generated/dist/gateway/client';
import { getHealth } from '@mealplanner/generated/dist/gateway/sdk.gen';
import type { GetHealthResponses, GetHealthErrors } from '@mealplanner/generated/dist/gateway/types.gen';

const gatewayClient = createClient(
  createConfig({
    baseUrl: 'http://localhost:8090/api',
  }),
);

const POLL_INTERVAL = 3000;

const App: React.FC = () => {
  const [healthy, setHealthy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [services, setServices] = useState<Record<string, boolean> | undefined>();
  const pollRef = useRef<NodeJS.Timeout>();

  const checkHealth = async () => {
    setChecking(true);
    try {
      const result = await getHealth({ client: gatewayClient });
      type Data = GetHealthResponses[keyof GetHealthResponses];
      type Err = GetHealthErrors[keyof GetHealthErrors];
      if ('data' in result && (result as { data?: Data }).data) {
        const svc = (result as { data: Data }).data.services;
        setServices(svc);
        const ok = svc ? Object.values(svc).every(Boolean) : false;
        setHealthy(ok);
        setChecking(false);
        return ok;
      }
      if ('error' in result && (result as { error?: Err }).error) {
        const svc = (result as { error?: Err }).error?.services as
          | Record<string, boolean>
          | undefined;
        if (svc) {
          setServices(svc);
          const ok = Object.values(svc).every(Boolean);
          setHealthy(ok);
          setChecking(false);
          return ok;
        }
      }
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
