#!/usr/bin/env ts-node

import {
  startServices,
  setupCleanupHandlers,
  cleanup,
  waitForAllServices,
  createSession,
  sendMessage,
  sleep,
  type ServiceProcesses
} from './lib';

async function main(): Promise<void> {
  let processes: ServiceProcesses = {};

  try {
    // Start all services
    console.log('=== STARTING SERVICES ===');
    processes = await startServices();
    setupCleanupHandlers(processes);

    // Wait for all services to be ready
    await waitForAllServices();

    // Create session and get thread ID
    const threadId = await createSession();

    // Send a test message and look for the debug output
    await sendMessage(threadId, "Test message for debugging");

    console.log('--- Check the debug output above for UpdateWorkflowCheckpointWithMessage ---');

    // Clean up and exit
    await sleep(2000); // Let logs settle
    await cleanup(processes);
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    await cleanup(processes);
    process.exit(1);
  }
}

main();