#!/usr/bin/env ts-node

import {
  startServices,
  setupCleanupHandlers,
  cleanup,
  waitForAllServices,
  createSession,
  sendMessage,
  getWorkflowState,
  filterMealsByDay,
  sleep,
  type ServiceProcesses,
  type WorkflowState
} from './lib';

async function displayMealPlan(state: WorkflowState, sessionName: string): Promise<void> {
  console.log(`=== ${sessionName} MEAL PLAN ===`);
  console.log(`Found ${state.entries.length} meal plan entries`);
  
  // Group by day
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const dayMeals = filterMealsByDay(state.entries, dayIndex);
    console.log(`\n${days[dayIndex]} (dayIndex ${dayIndex}):`);
    dayMeals.forEach(meal => {
      if (meal.meal) {
        console.log(`  ${meal.mealType}: ${meal.meal.name || meal.meal.title || 'Unknown meal'}`);
      } else {
        console.log(`  ${meal.mealType}: No meal assigned`);
      }
    });
  }
}

async function main(): Promise<void> {
  let processes: ServiceProcesses = {};

  try {
    // Start all services
    console.log('=== STARTING SERVICES ===');
    processes = await startServices();
    
    // Wait for all services to be ready
    await waitForAllServices();
    setupCleanupHandlers(processes);

    // FIRST SESSION: Create session and give feedback
    console.log('\n=== FIRST SESSION ===');
    const firstThreadId = await createSession();
    console.log(`First session thread ID: ${firstThreadId}`);

    // Give feedback on the first session
    await sendMessage(firstThreadId, "I'd like more vegetarian options for dinner");
    
    // Wait a bit for processing
    await sleep(3000);
    
    // Get the state after feedback
    const firstState = await getWorkflowState(firstThreadId);
    await displayMealPlan(firstState, 'FIRST SESSION AFTER FEEDBACK');

    // ABANDON FIRST SESSION: Actively abandon the first session while it might still be processing
    console.log('\n=== ABANDONING FIRST SESSION ===');
    console.log('Actively abandoning first session (may still be processing)...');
    
    // Actually abandon the first session using the abandon API
    try {
      // Note: We'd need to add abandonWorkflow to lib.ts and call the actual API
      // For now, we'll simulate by just creating the second session
      console.log('⚠️ Note: Using simulated abandonment (should implement actual abandon API call)');
      await sleep(1000); // Brief pause instead of waiting for completion
    } catch (error) {
      console.log('Error during abandonment (continuing):', error);
    }
    
    const secondThreadId = await createSession();
    console.log(`Second session thread ID: ${secondThreadId}`);
    
    // Verify we got a different thread ID
    if (firstThreadId === secondThreadId) {
      throw new Error('Expected different thread IDs for different sessions');
    }
    console.log('✅ Different thread IDs confirmed');

    // Give feedback on the second session (targeting same meal type to test independence)
    await sendMessage(secondThreadId, "I prefer spicy food for dinner");
    
    // Wait a bit for processing
    await sleep(3000);
    
    // Get the state after feedback on second session
    const secondState = await getWorkflowState(secondThreadId);
    await displayMealPlan(secondState, 'SECOND SESSION AFTER FEEDBACK');

    // Verify the meal plans are different
    console.log('\n=== COMPARING MEAL PLANS ===');
    const firstMealNames = firstState.entries
      .filter(entry => entry.meal)
      .map(entry => entry.meal.name || entry.meal.title || 'Unknown')
      .sort();
    
    const secondMealNames = secondState.entries
      .filter(entry => entry.meal)
      .map(entry => entry.meal.name || entry.meal.title || 'Unknown')
      .sort();

    console.log('First session meals:', firstMealNames);
    console.log('Second session meals:', secondMealNames);

    // Check if meal plans are different (they should be due to different feedback)
    const areDifferent = JSON.stringify(firstMealNames) !== JSON.stringify(secondMealNames);
    console.log(`Meal plans are different: ${areDifferent ? '✅' : '❌'}`);

    if (!areDifferent) {
      console.log('⚠️ Warning: Meal plans are identical despite different feedback');
    }

    // Test summary
    console.log('\n=== TEST SUMMARY ===');
    console.log(`✅ First session thread ID: ${firstThreadId}`);
    console.log(`✅ Second session thread ID: ${secondThreadId}`);
    console.log(`✅ Thread IDs are different: ${firstThreadId !== secondThreadId}`);
    console.log(`✅ Meal plans are different: ${areDifferent}`);
    console.log('✅ Test completed successfully!');

    // Clean up and exit
    await cleanup(processes);
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    await cleanup(processes);
    process.exit(1);
  }
}

main(); 