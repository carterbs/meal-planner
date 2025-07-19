#!/usr/bin/env ts-node

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { createClient, createConfig } from '@mealplanner/generated/dist/gateway/client/index.js';
import { postAgentStart, postAgentMessage, getCheckpointsByThreadId } from '@mealplanner/generated/dist/gateway/index.js';

const execAsync = promisify(exec);

// Create the API gateway client
const gatewayClient = createClient(createConfig({
  baseUrl: 'http://localhost:8080/api'
}));

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForAllServices(): Promise<void> {
  console.log('--- Waiting for all services to be ready ---');

  for (let i = 1; i <= 20; i++) {
    try {
      const result = await gatewayClient.get({
        url: '/health',
        throwOnError: false
      });

      if (result.response.status === 200) {
        const healthData = result.data as any;
        console.log('--- Health check response ---');
        console.log(JSON.stringify(healthData, null, 2));
        
        // Check if all services are healthy
        if (healthData.services && 
            healthData.services.backend === true && 
            healthData.services.agent === true && 
            healthData.services.mcp === true) {
          console.log('✅ All services are healthy!');
          return;
        } else {
          console.log('⚠️ Some services are not healthy yet:', healthData.services);
        }
      }
    } catch (error) {
      console.log('--- Health check failed, retrying ---');
    }
    await sleep(1000);
  }

  throw new Error('Services failed to start within 20 seconds');
}

async function createSession(): Promise<string> {
  console.log('--- Creating session ---');

  const startRequest = {
    workflowType: 'meal_planning',
    participants: ['user'],
  };

  const result = await postAgentStart({
    client: gatewayClient,
    body: startRequest,
  });

  if (!result.data || !result.data.response || !result.data.response.threadId) {
    throw new Error(`Failed to create session: ${result.error || 'Unknown error'}`);
  }

  console.log(`✅ Session created: ${result.data.response.threadId}`);
  return result.data.response.threadId;
}

async function sendMessage(threadId: string, message: string): Promise<void> {
  console.log(`--- Sending message: "${message}" ---`);

  const messageRequest = {
    threadId,
    message,
    from: 'user',
    interactive: false,
  };

  const result = await postAgentMessage({
    client: gatewayClient,
    body: messageRequest,
  });

  if (!result.data) {
    throw new Error(`Failed to send message: ${result.error || 'Unknown error'}`);
  }

  console.log('✅ Message sent successfully');
}

async function main(): Promise<void> {
  let backendProcess: any = null;
  let gatewayProcess: any = null;
  let loggingProcess: any = null;

  // Cleanup function
  const cleanup = async () => {
    console.log('--- Cleaning up ---');
    if (backendProcess) {
      backendProcess.kill('SIGTERM');
    }
    if (gatewayProcess) {
      gatewayProcess.kill('SIGTERM');
    }
    if (loggingProcess) {
      loggingProcess.kill('SIGTERM');
    }
    await execAsync('yarn kill:servers').catch(() => { });
  };

  // Handle process exit
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    // Kill existing servers
    await execAsync('yarn kill:servers').catch(() => {});

    // Start logging service
    console.log('--- Starting logging service ---');
    loggingProcess = spawn('go', ['run', '.'], {
      cwd: 'logging-service',
      stdio: 'inherit',
    });

    await sleep(2000); // Give logging service time to start

    // Start backend
    console.log('--- Starting backend ---');
    backendProcess = spawn('go', ['run', '.'], {
      cwd: 'meal-service',
      stdio: 'inherit',
    });

    // Start API gateway
    console.log('--- Starting API gateway ---');
    gatewayProcess = spawn('go', ['run', '.'], {
      cwd: 'api-gateway',
      stdio: 'inherit',
    });

    // Wait for all services to be ready
    await waitForAllServices();

    // Create session and get thread ID
    const threadId = await createSession();

    // Send a test message and look for the debug output
    await sendMessage(threadId, "Test message for debugging");

    console.log('--- Check the debug output above for UpdateWorkflowCheckpointWithMessage ---');

    // Clean up and exit
    await sleep(2000); // Let logs settle
    await cleanup();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    await cleanup();
    process.exit(1);
  }
}

main();