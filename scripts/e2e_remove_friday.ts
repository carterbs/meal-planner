#!/usr/bin/env ts-node

import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
// for debugging in vscode
const skipBackend = false;

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

async function waitForBackend(): Promise<void> {
  console.log('--- Waiting for backend to be ready ---');

  for (let i = 1; i <= 30; i++) {
    try {
      const response = await fetch('http://localhost:8080/api/health');
      if (response.ok) {
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

  const startRequest: AgentStartRequest = {
    workflowType: 'meal_planning',
    participants: ['user'],
  };

  const response = await fetch('http://localhost:8080/api/agent/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(startRequest),
  });

  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.statusText}`);
  }
 
  const sessionData = await response.json();
  return (sessionData as any).response.threadId;
}

async function sendMessage(threadId: string, message: string): Promise<void> {
  console.log('--- Sending message to remove Friday ---');

  const messageRequest: AgentMessageRequest = {
    threadId,
    message,
    from: 'user',
    interactive: false,
  };

  const response = await fetch('http://localhost:8080/api/agent/message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messageRequest),
  });

  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.statusText}`);
  }
}

async function getWorkflowState(threadId: string): Promise<WorkflowState> {
  const response = await fetch(`http://localhost:8080/api/checkpoints/${threadId}`);

  if (!response.ok) {
    throw new Error(`Failed to get checkpoint: ${response.statusText}`);
  }

  const data = await response.json() as any;
  console.log('=== RAW CHECKPOINT RESPONSE ===');
  console.log(JSON.stringify(data, null, 2));
  
  // The response structure is: { tuple: { checkpoint: { state: {...} } } }
  const state = data.tuple?.checkpoint?.state || data.state || data;
  
  // The meal plan data should be in the mealPlan field
  if (state.mealPlan?.days) {
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
  
  // Fallback to entries if available
  return state.entries ? state : { entries: [] };
}

function filterMealsByDay(entries: MealPlanEntry[], dayIndex: number): MealPlanEntry[] {
  return entries.filter(entry => entry.dayIndex === dayIndex);
}

function checkMealsRemoved(entries: MealPlanEntry[], dayIndex: number): boolean {
  const dayMeals = filterMealsByDay(entries, dayIndex);
  return dayMeals.every(entry => !entry.meal);
}

async function main(): Promise<void> {
  let backendProcess: any = null;
  let gatewayProcess: any = null;
  
  // Cleanup function
  const cleanup = async () => {
    await sleep(2000); // let logs settle
    if (backendProcess) {
      backendProcess.kill('SIGTERM');
    }
    if (gatewayProcess) {
      gatewayProcess.kill('SIGTERM');
    }
    await execAsync('yarn kill:servers').catch(() => {});
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

    // Start backend
    console.log('--- Starting backend ---');
    if (skipBackend) {
      console.log('Skipping backend start');
    } else {
      backendProcess = spawn('go', ['run', '.'], {
        cwd: 'backend',
        stdio: 'inherit',
      });
    }

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

    // Send message to remove Friday meals
    await sendMessage(threadId, "remove all of friday's meals");

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