#!/usr/bin/env ts-node

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { createClient, createConfig } from '@mealplanner/generated/dist/gateway/client/index.js';
import { postAgentStart, postAgentMessage, getCheckpointsByThreadId } from '@mealplanner/generated/dist/gateway/index.js';

const execAsync = promisify(exec);
// for debugging in vscode
const skipBackend = false;

// Create the API gateway client
const gatewayClient = createClient(createConfig({
  baseUrl: 'http://localhost:8090/api'
}));

interface SessionResponse {
  threadId: string;
}

interface MealPlanEntry {
  dayIndex: number;
  meal?: any;
}

interface WorkflowState {
  entries: MealPlanEntry[];
}

interface AgentStartRequest {
  workflowType: string;
  participants: string[];
}

interface AgentMessageRequest {
  threadId: string;
  message: string;
  from: string;
  interactive: boolean;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForAllServices(): Promise<void> {
  console.log('--- Waiting for all services to be ready ---');

  for (let i = 1; i <= 30; i++) {
    try {
      // Use the generated client for health check
      console.log(`--- Checking all services health (attempt ${i}/30) ---`);
      const result = await gatewayClient.get({
        url: '/health',
        throwOnError: false
      });

      console.log(`--- Health check response status: ${result.response.status} ---`);
      
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
          console.log('⚠️ Some services are not healthy yet:');
          console.log(`  - Backend: ${healthData.services?.backend || 'unknown'}`);
          console.log(`  - Agent: ${healthData.services?.agent || 'unknown'}`);
          console.log(`  - MCP: ${healthData.services?.mcp || 'unknown'}`);
        }
      } else {
        console.log(`❌ Health check returned status ${result.response.status}`);
        if (result.data) {
          console.log('Response data:', JSON.stringify(result.data, null, 2));
        }
      }
    } catch (error) {
      console.log('--- Health check failed, retrying ---');
      console.log('Error details:', error);
    }
    await sleep(1000);
  }

  throw new Error('Services failed to start within 30 seconds');
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
    console.log('--- Failed to create session ---');
    console.log(JSON.stringify(result, null, 2));
    throw new Error(`Failed to create session: ${result.error || 'Unknown error'}`);
  }

  return result.data.response.threadId
}

async function sendMessage(threadId: string, message: string): Promise<void> {
  console.log('--- Sending message to remove Friday ---');

  const messageRequest = {
    threadId,
    message,
    from: 'user',
    interactive: false,
  };

  console.log('=== SENDING MESSAGE ===');
  console.log('Request:', JSON.stringify(messageRequest, null, 2));
  
  const result = await postAgentMessage({
    client: gatewayClient,
    body: messageRequest,
  });

  console.log('=== MESSAGE RESULT ===');
  console.log('Result:', JSON.stringify(result, null, 2));

  if (!result.data) {
    throw new Error(`Failed to send message: ${result.error || 'Unknown error'}`);
  }
}

async function getWorkflowState(threadId: string): Promise<WorkflowState> {
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

  // The response structure is: { tuple: { checkpoint: { state: {...} } } }
  const state = data.tuple?.checkpoint?.state;
  if (!state || !state.mealPlan || !state.mealPlan.days) {
    throw new Error('Failed to get checkpoint state');
  }

  // The meal plan data should be in the mealPlan field
  console.log('=== FOUND MEAL PLAN DAYS ===');
  console.log(`Found ${state.mealPlan.days.length} meal plan entries`);
  // Add dayIndex and mealType fields if they're missing
  const entries = state.mealPlan.days.map((day: any, index: number) => ({
    dayIndex: day.dayIndex !== undefined ? day.dayIndex : Math.floor(index / 3), // Approximate dayIndex
    mealType: day.mealType || (['breakfast', 'lunch', 'dinner'][index % 3]),
    meal: day.meal
  }));
  return { entries };
}

function filterMealsByDay(entries: MealPlanEntry[], dayIndex: number): MealPlanEntry[] {
  return entries.filter(entry => entry.dayIndex === dayIndex);
}

function checkMealsRemoved(entries: MealPlanEntry[], dayIndex: number): boolean {
  const dayMeals = filterMealsByDay(entries, dayIndex);
  return dayMeals.every(entry => !entry.meal);
}

async function main(): Promise<void> {
  let loggingProcess: any = null;
  let backendProcess: any = null;
  let gatewayProcess: any = null;
  let agentProcess: any = null;
  let mcpProcess: any = null;

  // Cleanup function
  const cleanup = async () => {
    await sleep(2000); // let logs settle
    if (loggingProcess) {
      loggingProcess.kill('SIGTERM');
    }
    if (backendProcess) {
      backendProcess.kill('SIGTERM');
    }
    if (gatewayProcess) {
      gatewayProcess.kill('SIGTERM');
    }
    if (agentProcess) {
      agentProcess.kill('SIGTERM');
    }
    if (mcpProcess) {
      mcpProcess.kill('SIGTERM');
    }
    await execAsync('yarn kill:servers').catch(() => { });
  };

  // Handle process exit
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    // Kill existing servers
    if (!skipBackend) {
      await execAsync('yarn kill:servers');
    }

    // Start logging service first
    console.log('--- Starting logging service ---');
    loggingProcess = spawn('go', ['run', '.'], {
      cwd: 'logging-service',
      stdio: 'inherit',
    });


    // Start backend
    console.log('--- Starting backend ---');
    if (skipBackend) {
      console.log('Skipping backend start');
    } else {
      backendProcess = spawn('go', ['run', '.'], {
        cwd: 'meal-service',
        stdio: 'inherit',
      });
      
    }

    // Start API gateway
    console.log('--- Starting API gateway ---');
    gatewayProcess = spawn('go', ['run', '.'], {
      cwd: 'api-gateway',
      stdio: 'inherit',
    });


    // Start MCP server
    console.log('--- Starting MCP server ---');
    mcpProcess = spawn('yarn', ['start:mcp'], {
      cwd: '.',
      stdio: 'inherit',
    });

    // Start agent service
    console.log('--- Starting agent service ---');
    agentProcess = spawn('yarn', ['start:grpc'], {
      cwd: '.',
      stdio: 'inherit',
    });

    // Wait for all services to be ready
    await waitForAllServices();

    // Create session and get thread ID
    console.log('=== CREATING SESSION ===');
    const threadId = await createSession();
    console.log('=== SESSION CREATED ===', threadId);

    // Send message to remove Friday meals
    console.log('=== ABOUT TO SEND MESSAGE ===');
    try {
      await sendMessage(threadId, "remove all of friday's meals");
      console.log('=== MESSAGE SENT SUCCESSFULLY ===');
    } catch (error) {
      console.error('=== ERROR SENDING MESSAGE ===', error);
      throw error;
    }

    // Fetch and check results
    console.log('--- Fetching state and checking results ---');
    const state = await getWorkflowState(threadId);
    console.log('=== FULL STATE ===');
    console.log(JSON.stringify(state, null, 2));

    if (!state.entries) {
      console.log('❌ No entries found in state - test cannot verify meal removal');
      return;
    }

    // Display Friday meals (dayIndex 4)
    console.log('=== FRIDAY MEALS (dayIndex 4) ===');
    const fridayMeals = filterMealsByDay(state.entries, 4);
    console.log(JSON.stringify(fridayMeals, null, 2));

    // Display Saturday meals (dayIndex 5)
    console.log('=== SATURDAY MEALS (dayIndex 5) ===');
    const saturdayMeals = filterMealsByDay(state.entries, 5);
    console.log(JSON.stringify(saturdayMeals, null, 2));

    // Display day names mapping
    console.log('=== DAY NAMES MAPPING ===');
    console.log('0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday');

    // Check if Friday meals are removed
    const fridayMealsRemoved = checkMealsRemoved(state.entries, 4);
    console.log(`Friday meals removed: ${fridayMealsRemoved}`);

    // Check if Saturday meals are removed
    const saturdayMealsRemoved = checkMealsRemoved(state.entries, 5);
    console.log(`Saturday meals removed: ${saturdayMealsRemoved}`);

    // Clean up and exit
    await cleanup();
    process.exit(0);

  } catch (error) {
    console.error('Error:', error);
    await cleanup();
    process.exit(1);
  }
}

main();