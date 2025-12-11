#!/usr/bin/env ts-node

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { createClient, createConfig } from '@mealplanner/generated/dist/gateway/client/index.js';
import { postAgentStart, postAgentMessage, getCheckpointsByThreadId } from '@mealplanner/generated/dist/gateway/index.js';

const execAsync = promisify(exec);

// Create the API gateway client factory
export function createGatewayClient() {
  return createClient(createConfig({
    baseUrl: 'http://localhost:8090/api'
  }));
}

// Create the client instance
const gatewayClient = createGatewayClient();

export interface SessionResponse {
  threadId: string;
}

export interface MealPlanEntry {
  dayIndex: number;
  mealType?: string;
  meal?: any;
}

export interface WorkflowState {
  entries: MealPlanEntry[];
}

export interface AgentStartRequest {
  workflowType: string;
  participants: string[];
}

export interface AgentMessageRequest {
  threadId: string;
  message: string;
  from: string;
  interactive: boolean;
}

function mealSlotToString(slot?: number): string {
  switch (slot) {
    case 1:
      return 'breakfast';
    case 2:
      return 'lunch';
    case 3:
      return 'dinner';
    default:
      return '';
  }
}

export interface ServiceProcesses {
  loggingProcess?: any;
  backendProcess?: any;
  gatewayProcess?: any;
  agentProcess?: any;
  mcpProcess?: any;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitForAllServices(): Promise<void> {
  console.log('--- Waiting for all services to be ready ---');

  for (let i = 1; i <= 30; i++) {
    try {
      console.log(`--- Checking all services health (attempt ${i}/30) ---`);
      console.log('--- About to make health check request ---');
      const result = await gatewayClient.get({
        url: '/health',
        throwOnError: false
      });
      console.log('--- Health check request completed ---');

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

export async function createSession(): Promise<string> {
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

  console.log(`✅ Session created: ${result.data.response.threadId}`);
  return result.data.response.threadId;
}

export async function sendMessage(threadId: string, message: string): Promise<void> {
  console.log(`--- Sending message: "${message}" ---`);

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

  console.log('✅ Message sent successfully');
}

export async function getWorkflowState(threadId: string): Promise<WorkflowState> {
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
  const plan = state?.mealPlan;
  const items = plan?.items;
  if (!state || !plan || !Array.isArray(items)) {
    throw new Error('Failed to get checkpoint state');
  }

  // The meal plan data should be in the mealPlan field
  console.log('=== FOUND MEAL PLAN ITEMS ===');
  console.log(`Found ${items.length} meal plan entries`);
  const entries = items.map((item: any) => ({
    dayIndex: item?.dayIndex ?? 0,
    mealType: mealSlotToString(item?.mealType),
    meal: item?.mealSnapshot ?? item?.meal ?? null,
  }));
  return { entries };
}

export function filterMealsByDay(entries: MealPlanEntry[], dayIndex: number): MealPlanEntry[] {
  return entries.filter(entry => entry.dayIndex === dayIndex);
}

export function checkMealsRemoved(entries: MealPlanEntry[], dayIndex: number): boolean {
  const dayMeals = filterMealsByDay(entries, dayIndex);
  return dayMeals.every(entry => !entry.meal);
}

export async function startServices(skipBackend: boolean = false): Promise<ServiceProcesses> {
  const processes: ServiceProcesses = {};

  // Kill existing servers
  if (!skipBackend) {
    await execAsync('yarn kill:servers');
  }

  // Start logging service first
  console.log('--- Starting logging service ---');
  processes.loggingProcess = spawn('go', ['run', '.'], {
    cwd: 'logging-service',
    stdio: 'inherit',
  });

  // Start backend
  console.log('--- Starting backend ---');
  if (skipBackend) {
    console.log('Skipping backend start');
  } else {
    processes.backendProcess = spawn('go', ['run', '.'], {
      cwd: 'meal-service',
      stdio: 'inherit',
    });
  }

  // Start API gateway
  console.log('--- Starting API gateway ---');
  processes.gatewayProcess = spawn('go', ['run', '.'], {
    cwd: 'api-gateway',
    stdio: 'inherit',
  });

  // Start MCP server
  console.log('--- Starting MCP server ---');
  processes.mcpProcess = spawn('yarn', ['start:mcp'], {
    cwd: '.',
    stdio: 'inherit',
  });

  // Start agent service
  console.log('--- Starting agent service ---');
  processes.agentProcess = spawn('yarn', ['start:grpc'], {
    cwd: '.',
    stdio: 'inherit',
  });

  return processes;
}

export async function cleanup(processes: ServiceProcesses): Promise<void> {
  await sleep(2000); // let logs settle
  if (processes.loggingProcess) {
    processes.loggingProcess.kill('SIGTERM');
  }
  if (processes.backendProcess) {
    processes.backendProcess.kill('SIGTERM');
  }
  if (processes.gatewayProcess) {
    processes.gatewayProcess.kill('SIGTERM');
  }
  if (processes.agentProcess) {
    processes.agentProcess.kill('SIGTERM');
  }
  if (processes.mcpProcess) {
    processes.mcpProcess.kill('SIGTERM');
  }
  await execAsync('yarn kill:servers').catch(() => { });
}

export function setupCleanupHandlers(processes: ServiceProcesses): void {
  const cleanupHandler = async () => {
    await cleanup(processes);
  };

  process.on('exit', cleanupHandler);
  process.on('SIGINT', cleanupHandler);
  process.on('SIGTERM', cleanupHandler);
} 
