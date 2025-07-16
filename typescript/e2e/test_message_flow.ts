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

interface SessionResponse {
  threadId: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForBackend(): Promise<void> {
  console.log('--- Waiting for backend to be ready ---');

  for (let i = 1; i <= 30; i++) {
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

  throw new Error('Backend failed to start within 30 seconds');
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

async function checkMessages(threadId: string): Promise<void> {
  console.log('--- Checking checkpoint messages ---');

  const result = await getCheckpointsByThreadId({
    client: gatewayClient,
    path: { thread_id: threadId },
  });

  if (!result.data) {
    throw new Error(`Failed to get checkpoint: ${result.error || 'Unknown error'}`);
  }

  const data = result.data;
  console.log('=== RAW CHECKPOINT RESPONSE ===');
  console.log(JSON.stringify(data, null, 2));

  // Check messages in the checkpoint
  const messages = data.tuple?.checkpoint?.messages;
  if (!messages) {
    console.log('❌ No messages found in checkpoint');
    return;
  }

  console.log('=== MESSAGES FOUND ===');
  console.log(`Found ${messages.length} messages:`);
  
  messages.forEach((msg: any, index: number) => {
    console.log(`Message ${index + 1}:`);
    console.log(`  Sender: ${msg.sender || 'MISSING'}`);
    console.log(`  Content: ${msg.content || 'MISSING'}`);
    console.log(`  Created At: ${msg.createdAt || 'MISSING'}`);
    console.log(`  Thread ID: ${msg.threadId || 'MISSING'}`);
    
    // Check for missing fields
    if (!msg.content && msg.sender === 'user') {
      console.log(`  ❌ User message missing content field!`);
    }
    if (!msg.content && msg.sender === 'agent') {
      console.log(`  ❌ Agent message missing content field!`);
    }
    if (msg.content) {
      console.log(`  ✅ Message has content`);
    }
  });
}

async function main(): Promise<void> {
  let backendProcess: any = null;
  let gatewayProcess: any = null;
  let loggingProcess: any = null;

  // Cleanup function
  const cleanup = async () => {
    console.log('--- Cleaning up ---');
    await sleep(2000); // let logs settle
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

    // Send a test message
    await sendMessage(threadId, "Hello, please create a simple meal plan");

    // Give the agent time to process
    await sleep(5000);

    // Check the messages in the checkpoint
    await checkMessages(threadId);

    // Send another message to test the flow
    await sendMessage(threadId, "Can you modify the plan to be vegetarian?");

    // Give the agent time to process
    await sleep(5000);

    // Check messages again
    await checkMessages(threadId);

    console.log('--- Test completed ---');

    // Clean up and exit
    await cleanup();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    await cleanup();
    process.exit(1);
  }
}

main();