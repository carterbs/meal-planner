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

async function waitForBackend(): Promise<void> {
  console.log('--- Waiting for backend to be ready ---');

  for (let i = 1; i <= 20; i++) {
    try {
      const result = await gatewayClient.get({
        url: '/health',
        throwOnError: false
      });

      if (result.response.status === 200) {
        console.log('✅ Backend is ready');
        return;
      }
    } catch (error) {
      // Continue waiting
    }
    await sleep(1000);
  }

  throw new Error('Backend failed to start within 20 seconds');
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
      cwd: 'backend',
      stdio: 'inherit',
    });

    // Start API gateway
    console.log('--- Starting API gateway ---');
    gatewayProcess = spawn('go', ['run', '.'], {
      cwd: 'api-gateway',
      stdio: 'inherit',
    });

    // Wait for backend to be ready
    await waitForBackend();

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