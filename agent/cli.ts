#!/usr/bin/env node

// Load environment variables FIRST before any other imports
import { config as dotenvConfig } from 'dotenv';
import { join } from 'path';
import { writeFileSync, appendFileSync } from 'fs';

// In CommonJS builds __dirname is available globally. Fallback to process.cwd() when it isn't (e.g. during tests).
const CURRENT_DIR = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

const envPath = join(CURRENT_DIR, '..', '.env');
const debugLogPath = join(CURRENT_DIR, '..', 'cli-debug.log');
// In built version, we're in dist/ so go up one level to agent/
// (moved above into CURRENT_DIR block)
// (moved above into CURRENT_DIR block)

// Debug logger that works in JSON mode
export function debugLog(message: string) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  try {
    appendFileSync(debugLogPath, logEntry);
  } catch (err) {
    // If file doesn't exist, create it
    try {
      writeFileSync(debugLogPath, logEntry);
    } catch (createErr) {
      // Ignore logging errors to prevent blocking execution
    }
  }
}

debugLog('CLI starting...');

// Smart output filtering for JSON mode
let outputBuffer: string[] = [];
let errorBuffer: string[] = [];
let originalStdoutWrite: typeof process.stdout.write;
let originalStderrWrite: typeof process.stderr.write;
// Flag to track if a valid JSON response has already been emitted
let jsonOutputSent = false;

function extractValidJSON(buffer: string[]): string | null {
  // Join all buffered chunks for robust multiline search
  const full = buffer.join('');
  // Find all substrings that look like JSON objects
  const potentialMatches = full.match(/\{[\s\S]*?\}/g);
  if (!potentialMatches) {
    debugLog('No brace-enclosed segments found when extracting JSON');
    return null;
  }
  // Iterate from last to first to get the FINAL response
  for (let i = potentialMatches.length - 1; i >= 0; i--) {
    const candidate = potentialMatches[i];
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && 'success' in parsed) {
        debugLog(`Valid JSON extracted (size ${candidate.length})`);
        return candidate;
      }
    } catch {
      // Not valid JSON, keep searching
    }
  }
  return null;
}


// Real-time JSON detection helper – attempts to emit a clean JSON line to the original stdout
function tryOutputJSON(str: string): boolean {
  const trimmed = str.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && 'success' in parsed) {
      originalStdoutWrite.call(process.stdout, trimmed + '\n');
      debugLog('Real-time JSON emitted');
      jsonOutputSent = true;
      return true;
    }
  } catch {
    // ignore JSON parse errors – not a valid JSON payload
  }
  return false;
}

function flushFilteredOutput() {
  if (!process.argv.includes('--json')) {
    return;
  }
  // Skip flushing if we already emitted a valid JSON response in real time
  if (jsonOutputSent) {
    debugLog('Filtered JSON already emitted, skipping final flush');
    return;
  }
  const validJSON = extractValidJSON(outputBuffer);
  if (validJSON) {
    originalStdoutWrite.call(process.stdout, validJSON + '\n');
    debugLog('Successfully output filtered JSON response (flush)');
  } else {
    const errorMsg = 'No valid JSON response found in output';
    // Send entire captured output to stderr for diagnostics
    originalStderrWrite.call(process.stderr, errorMsg + '\n' + outputBuffer.join(''));
    debugLog(`Error: ${errorMsg}`);
    debugLog(`Full output buffer logged to stderr (${outputBuffer.length} chunks)`);
  }

}

// Setup output capture in JSON mode
if (process.argv.includes('--json')) {
  // Preserve original write functions
  originalStdoutWrite = process.stdout.write.bind(process.stdout);
  originalStderrWrite = process.stderr.write.bind(process.stderr);
  
  // Override stdout to capture all output
  process.stdout.write = function(chunk: any): boolean {
    const str = chunk.toString();
    outputBuffer.push(str);
    debugLog(`[STDOUT] ${str.replace(/\n/g, '\\n')}`);
    // Attempt real-time JSON detection/output
    tryOutputJSON(str);
    return true;
  } as any;
  
  // Override stderr to capture errors
  process.stderr.write = function(chunk: any): boolean {
    const str = chunk.toString();
    errorBuffer.push(str);
    debugLog(`[STDERR] ${str.replace(/\n/g, '\\n')}`);
    // Forward to original stderr so that errors are visible immediately
    originalStderrWrite.call(process.stderr, str);
    return true;
  } as any;
  
  // Override console methods to also use capture
  console.log = (message: any) => {
    const str = String(message) + '\n';
    outputBuffer.push(str);
    debugLog(`[CONSOLE.LOG] ${str.replace(/\n/g, '\\n')}`);
    // Attempt real-time JSON detection/output
    tryOutputJSON(str);
  };
  console.error = debugLog;
  console.warn = debugLog;
  console.info = debugLog;
  console.debug = debugLog;
  
  // Setup cleanup on process exit
  process.on('exit', flushFilteredOutput);
  process.on('SIGINT', () => {
    debugLog('SIGINT received, flushing output...');
    flushFilteredOutput();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    debugLog('SIGTERM received, flushing output...');
    flushFilteredOutput();
    process.exit(0);
  });
} else {
  // Non-JSON mode: override console methods to use file logging
  console.log = debugLog;
  console.error = debugLog;
  console.warn = debugLog;
  console.info = debugLog;
  console.debug = debugLog;
}

const result = dotenvConfig({ path: envPath });

// Debug environment loading (only in non-JSON mode)
if (!process.argv.includes('--json')) {
  console.log(`📧 [ENV] Loading from: ${envPath}`);
  console.log(`📧 [ENV] Result:`, result.error ? `Error: ${result.error}` : 'Success');
  console.log(`📧 [ENV] OPENAI_API_KEY present:`, !!process.env.OPENAI_API_KEY);
}

debugLog(`Environment loaded from: ${envPath}`);
debugLog(`Environment result: ${result.error ? `Error: ${result.error}` : 'Success'}`);
debugLog(`OPENAI_API_KEY present: ${!!process.env.OPENAI_API_KEY}`);

// Now import everything else
import { Command } from 'commander';
import { LangGraphAgent, LangGraphAgentConfig } from './langgraph-agent';
import { WorkflowType } from './shared/types';
import { CLIHandler } from './io/cliHandler';
import { formatMealPlan } from './utils/formatMealPlan';
import { spawnSync } from 'child_process';
import { MessageGenerator } from './utils/messageGenerator';

const program = new Command();

// Global configuration
const config: LangGraphAgentConfig = {
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'meal_planner_dev',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
  },
  defaultParticipants: ['brad', 'shannon']
};

let agent: LangGraphAgent;

// Helper function to initialize agent
async function initializeAgent(): Promise<LangGraphAgent> {
  if (!agent) {
    agent = new LangGraphAgent(config);
    await agent.initialize();
  }
  return agent;
}

// Helper function to validate thread ID format
function validateThreadId(threadId: string): boolean {
  return /^[a-f0-9-]{36}$/.test(threadId);
}

// Helper function to output results in JSON or console format
function outputResult(result: {
  success: boolean;
  message?: string;
  threadId?: string;
  currentStep?: string;
  raw?: any;
}, isJsonMode: boolean = false) {
  if (isJsonMode) {
    // In JSON mode, this will be captured and filtered
    console.log(JSON.stringify(result));
  } else {
    // Handle console output based on result type
    if (result.success) {
      if (result.message) {
        console.log(`✅ ${result.message}`);
      }
      if (result.threadId) {
        console.log(`   Thread ID: ${result.threadId}`);
      }
      if (result.currentStep) {
        console.log(`   Current step: ${result.currentStep}`);
      }
    } else {
      console.error(`❌ ${result.message || 'Operation failed'}`);
      process.exit(1);
    }
  }
}

// Helper function to output errors in JSON or console format
function outputError(message: string, isJsonMode: boolean = false) {
  if (isJsonMode) {
    // In JSON mode, this will be captured and filtered
    console.log(JSON.stringify({ success: false, message }));
    // Force flush and exit in JSON mode
    flushFilteredOutput();
  } else {
    console.error(`❌ ${message}`);
  }
  process.exit(1);
}

// Helper function to format workflow list
function formatWorkflowList(workflows: any[]): string {
  if (workflows.length === 0) {
    return 'No workflows found.';
  }

  const headers = ['Thread ID', 'Type', 'Status', 'Created', 'Participants'];
  const maxWidths = headers.map(h => h.length);
  
  // Calculate column widths
  workflows.forEach(w => {
    const row = [
      w.threadId || 'N/A',
      w.workflowType || 'N/A',
      w.currentStep || 'N/A',
      w.createdAt ? new Date(w.createdAt).toLocaleDateString() : 'N/A',
      (w.participants || []).join(', ') || 'N/A'
    ];
    row.forEach((cell, i) => {
      maxWidths[i] = Math.max(maxWidths[i], cell.length);
    });
  });

  // Build table
  const separator = '┼' + maxWidths.map(w => '─'.repeat(w + 2)).join('┼') + '┼';
  const headerRow = '│ ' + headers.map((h, i) => h.padEnd(maxWidths[i])).join(' │ ') + ' │';
  
  let result = '┌' + maxWidths.map(w => '─'.repeat(w + 2)).join('┬') + '┐\n';
  result += headerRow + '\n';
  result += separator + '\n';
  
  workflows.forEach(w => {
    const row = [
      (w.threadId || 'N/A').substring(0, 8) + '...',
      w.workflowType || 'N/A',
      w.currentStep || 'N/A',
      w.createdAt ? new Date(w.createdAt).toLocaleDateString() : 'N/A',
      (w.participants || []).join(', ') || 'N/A'
    ];
    const rowStr = '│ ' + row.map((cell, i) => cell.padEnd(maxWidths[i])).join(' │ ') + ' │';
    result += rowStr + '\n';
  });
  
  result += '└' + maxWidths.map(w => '─'.repeat(w + 2)).join('┴') + '┘';
  return result;
}

// Helper function to check if there's recent feedback in the workflow result
function hasRecentFeedbackInResult(result: any): boolean {
  try {
    // Check both top level and raw for feedback_history
    const feedbackHistory = result.feedback_history || result.raw?.feedback_history;
    if (!feedbackHistory || !Array.isArray(feedbackHistory) || feedbackHistory.length === 0) {
      debugLog(`[FEEDBACK_CHECK] No feedback history in result`);
      return false;
    }
    
    // Check if there's feedback within the last 30 seconds
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
    const hasRecent = feedbackHistory.some((feedback: any) => {
      const feedbackTime = new Date(feedback.timestamp);
      return feedbackTime > thirtySecondsAgo;
    });
    
    debugLog(`[FEEDBACK_CHECK] Found ${feedbackHistory.length} feedback entries, ${hasRecent ? 'has' : 'no'} recent feedback`);
    return hasRecent;
  } catch (error) {
    debugLog(`[FEEDBACK_CHECK] Error checking for recent feedback: ${error}`);
    return false;
  }
}

// Main program configuration
program
  .name('meal-agent')
  .description('Meal planning agent with multi-workflow support')
  .version('1.0.0')
  .option('--json', 'Output results in JSON format for API integration', false);

// Plan command group
const planCommand = program
  .command('plan')
  .description('Meal planning workflow commands');

planCommand
  .command('start')
  .description('Start a new meal planning session')
  .option('-p, --participants <participants>', 'Comma-separated list of participants', 'brad,shannon')
  .action(async (options) => {
    const isJsonMode = program.getOptionValue('json');
    
    try {
      const agent = await initializeAgent();
      const participants = options.participants.split(',').map((p: string) => p.trim());
      
      if (!isJsonMode) {
        console.log(`🚀 Starting new meal planning session with participants: ${participants.join(', ')}`);
      }
      
      const threadId = await agent.startWorkflow(WorkflowType.MEAL_PLANNING, participants);
      process.stderr.write(`[DEBUG CLI plan start] Raw threadId from agent.startWorkflow: ${threadId}\n`);

      let initialState = undefined;
      try {
        initialState = await agent.getWorkflowState(threadId);
      } catch (e) {
        process.stderr.write(`[DEBUG CLI plan start] Failed to fetch initial workflow state: ${e}\n`);
      }

      const resultToOutput = {
        success: true,
        message: 'Meal planning session started',
        threadId: threadId,
        current_step: 'started',
        initialState
      };
      console.error(`[DEBUG CLI plan start] Object being passed to outputResult: ${JSON.stringify(resultToOutput)}`);
      outputResult(resultToOutput, isJsonMode);
      
      if (!isJsonMode) {
        console.log(`   Use: meal-agent plan feedback "${threadId}" "your feedback here"`);
        console.log(`   Or:  meal-agent resume ${threadId}`);
      } else {
        // In JSON mode, clean up and exit to prevent hanging
        debugLog('Shutting down agent and cleaning up connections...');
        if (agent) {
          try {
            await agent.shutdown();
            debugLog('Agent shutdown complete');
          } catch (shutdownError) {
            debugLog(`Error during agent shutdown: ${shutdownError}`);
          }
        }
        debugLog('Flushing filtered output and exiting process');
        flushFilteredOutput();
        process.exit(0);
      }
      
    } catch (error) {
      outputError(`Error starting meal planning session: ${error instanceof Error ? error.message : error}`, isJsonMode);
    }
  });

planCommand
  .command('feedback')
  .description('Provide feedback to an active meal planning session')
  .argument('<thread-id>', 'Thread ID of the meal planning session')
  .argument('<message>', 'Your feedback message')
  .option('-f, --from <participant>', 'Who is providing the feedback', 'brad')
  .action(async (threadId, message, options) => {
    const isJsonMode = program.getOptionValue('json');
    
    try {
      if (!validateThreadId(threadId)) {
        outputError('Invalid thread ID format. Expected UUID format.', isJsonMode);
        return;
      }

      const agent = await initializeAgent();
      
      // Check if workflow is awaiting feedback
      const isAwaiting = await agent.isAwaitingFeedback(threadId);
      if (!isAwaiting) {
        outputError('This workflow is not currently awaiting feedback.', isJsonMode);
        return;
      }

      const success = await agent.addFeedback({
        threadId,
        from: options.from,
        message
      });

      if (success) {
        outputResult({
          success: true,
          message: `Feedback added successfully from ${options.from}`
        }, isJsonMode);

        if (isJsonMode) {
          debugLog('Shutting down agent and cleaning up connections...');
          if (agent) {
            try {
              await agent.shutdown();
              debugLog('Agent shutdown complete');
            } catch (shutdownError) {
              debugLog(`Error during agent shutdown: ${shutdownError}`);
            }
          }
          debugLog('Flushing filtered output and exiting process');
          flushFilteredOutput();
          process.exit(0);
        } else {
          console.log(`   Use: meal-agent resume ${threadId} to continue the workflow`);
        }
      } else {
        outputError('Failed to add feedback. Check thread ID and try again.', isJsonMode);
      }
      
    } catch (error) {
      outputError(`Error adding feedback: ${error instanceof Error ? error.message : error}`, isJsonMode);
    }
  });

planCommand
  .command('finalize')
  .description('Finalize the current meal plan and generate shopping list')
  .argument('<thread-id>', 'Thread ID of the meal planning session')
  .action(async (threadId) => {
    try {
      if (!validateThreadId(threadId)) {
        console.error('❌ Invalid thread ID format. Expected UUID format.');
        process.exit(1);
      }

      const agent = await initializeAgent();
      
      console.log('🔄 Finalizing meal plan and generating shopping list...');
      
      const result = await agent.resumeWorkflow(threadId, { action: 'finalize' });
      
      if (result.success) {
        console.log('✅ Meal plan finalized successfully!');
        
        // Get and display the final meal plan
        try {
          const state = await agent.getWorkflowState(threadId);
          if (state.meal_plan) {
            const { text, html } = formatMealPlan(state.meal_plan);
            console.log('\n📋 Final Meal Plan:');
            console.log(text);
            
            // Copy HTML to clipboard
            try {
              spawnSync('pbcopy', ['-Prefer', 'html'], { input: html });
              console.log('✅ HTML table copied to clipboard');
            } catch (err) {
              console.error('⚠️ Failed to copy HTML to clipboard:', err);
            }
          }
          
          if (state.shopping_list && state.shopping_list.length > 0) {
            console.log('\n🛒 Shopping List:');
            state.shopping_list.forEach(item => {
              console.log(`  • ${item.quantity} ${item.ingredient}${item.category ? ` (${item.category})` : ''}`);
            });
          }
        } catch (stateError) {
          console.warn('⚠️ Could not retrieve final state details');
        }
      } else {
        console.error('❌ Failed to finalize meal plan:', result.message);
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Error finalizing meal plan:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// General workflow management commands
program
  .command('status')
  .description('Show system status and statistics, or specific workflow status if thread ID provided')
  .argument('[thread-id]', 'Optional thread ID to get specific workflow status')
  .action(async (threadId) => {
    const isJsonMode = program.getOptionValue('json');
    
    try {
      const agent = await initializeAgent();
      
      if (threadId) {
        // Get specific workflow status
        if (!validateThreadId(threadId)) {
          outputError('Invalid thread ID format. Expected UUID format.', isJsonMode);
          return;
        }
        
        const status = await agent.getWorkflowStatus(threadId);
        if (!status) {
          outputError('Workflow not found.', isJsonMode);
          return;
        }
        
        outputResult({
          success: true,
          threadId: status.threadId,
          currentStep: status.currentStep,
          message: `Workflow status: ${status.currentStep}`,
          raw: status
        }, isJsonMode);
        if (isJsonMode) process.exit(0);
        
      } else {
        // Get system status
        const health = await agent.healthCheck();
        const stats = await agent.getStats();
        
        if (isJsonMode) {
          outputResult({
            success: true,
            message: 'System status retrieved',
            raw: { health, stats }
          }, isJsonMode);
          process.exit(0);
        } else {
          console.log('🏥 System Health:', health.status);
          console.log('📊 Statistics:');
          console.log(`   Active Sessions: ${stats.activeSessionCount}`);
          console.log(`   Total Workflows: ${stats.totalWorkflows}`);
          console.log('   Workflows by Type:');
          Object.entries(stats.workflowsByType).forEach(([type, count]) => {
            console.log(`     ${type}: ${count}`);
          });
          console.log(`   Supported Types: ${stats.supportedWorkflowTypes.join(', ')}`);
        }
      }
      
    } catch (error) {
      outputError(`Error getting status: ${error instanceof Error ? error.message : error}`, isJsonMode);
    }
  });

program
  .command('list')
  .description('List all workflows')
  .option('-t, --type <type>', 'Filter by workflow type (meal_planning, recipe_management, ingredient_management)')
  .action(async (options) => {
    const isJsonMode = program.getOptionValue('json');
    
    try {
      const workflowType = options.type as WorkflowType | undefined;
      
      if (workflowType && !Object.values(WorkflowType).includes(workflowType)) {
        outputError(`Invalid workflow type. Supported types: ${Object.values(WorkflowType).join(', ')}`, isJsonMode);
        return;
      }
      
      const agent = await initializeAgent();
      const workflows = await agent.listWorkflows(workflowType);
      
      if (isJsonMode) {
        outputResult({
          success: true,
          message: workflowType ? `${workflowType} workflows retrieved` : 'All workflows retrieved',
          raw: workflows
        }, isJsonMode);
      } else {
        if (workflowType) {
          console.log(`📋 ${workflowType} workflows:`);
        } else {
          console.log('📋 All workflows:');
        }
        
        console.log(formatWorkflowList(workflows));
      }
      
    } catch (error) {
      outputError(`Error listing workflows: ${error instanceof Error ? error.message : error}`, isJsonMode);
    }
  });

program
  .command('resume')
  .description('Resume a paused workflow')
  .argument('<thread-id>', 'Thread ID of the workflow to resume')
  .option('-i, --interactive', 'Resume in interactive mode', false)
  .action(async (threadId, options) => {
    const isJsonMode = program.getOptionValue('json');
    
    try {
      if (!validateThreadId(threadId)) {
        outputError('Invalid thread ID format. Expected UUID format.', isJsonMode);
        return;
      }

      const agent = await initializeAgent();
      
      // Get workflow status first
      const status = await agent.getWorkflowStatus(threadId);
      if (!status) {
        outputError('Workflow not found.', isJsonMode);
        return;
      }
      
      if (!isJsonMode) {
        console.log(`🔄 Resuming ${status.workflowType} workflow (${status.currentStep})`);
      }
      
      if (options.interactive) {
        // Interactive mode - start conversation loop (JSON mode not supported for interactive)
        if (isJsonMode) {
          outputError('Interactive mode not supported in JSON output mode', isJsonMode);
          return;
        }
        
        const io = new CLIHandler();
        const participants = status.participants || ['brad'];
        const user = participants[0];
        
        try {
          await io.sendMessage(`Resuming workflow ${threadId}`, 'System');
          
          while (true) {
            const input = await io.receiveInput('Your message', user);
            const response = await agent.handleMessage({
              from: user,
              message: input,
              timestamp: new Date(),
              threadId
            });
            
            await io.sendMessage(response.message, 'Agent');
            
            if (response.currentStep === 'complete' || !response.success) {
              await io.sendMessage('Session ended.', 'System');
              break;
            }
          }
        } finally {
          io.close();
        }
      } else {
        // Non-interactive mode - just resume
        const resumeStart = Date.now();
        debugLog('resume: resumeWorkflow start');
        const result = await agent.resumeWorkflow(threadId);
        debugLog(`resume: resumeWorkflow done (${Date.now() - resumeStart}ms)`);
        debugLog(`resume command total ${(Date.now() - resumeStart)}ms`);
        
        // Use LLM-generated message from workflow if available, otherwise fall back to generic message
        let message = result.success ? 'Workflow resumed successfully' : `Failed to resume workflow: ${result.message}`;
        
        if (result.success && (result.user_message || result.raw?.user_message)) {
          message = result.user_message || result.raw?.user_message;
          debugLog(`[RESUME] Using workflow-generated message: ${message}`);
        } else if (result.success && hasRecentFeedbackInResult(result)) {
          // Fallback to separate message generation if workflow didn't provide a message
          try {
            const messageGenerator = new MessageGenerator();
            const feedbackHistory = result.feedback_history || result.raw?.feedback_history || [];
            const latestFeedback = feedbackHistory[feedbackHistory.length - 1];
            
            const contextualMessage = await messageGenerator.generateResumeMessage({
              currentStep: result.currentStep,
              workflowType: status.workflowType,
              hasRecentFeedback: true,
              feedbackSummary: latestFeedback?.message,
              mealPlan: result.meal_plan || result.raw?.meal_plan,
              shoppingList: result.shopping_list || result.raw?.shopping_list,
              iteration: result.iteration_count || result.raw?.iteration_count
            });
            message = contextualMessage;
            debugLog(`[RESUME] Generated fallback contextual message: ${contextualMessage}`);
          } catch (error) {
            debugLog(`[RESUME] Error generating contextual message: ${error}`);
            // Fall back to default message
          }
        }
        
        outputResult({
          success: result.success,
          message: message,
          currentStep: result.currentStep,
          raw: result
        }, isJsonMode);

        if (isJsonMode) {
          debugLog('Shutting down agent after resume...');
          flushFilteredOutput();
          process.exit(result.success ? 0 : 1);
        }

        if (!result.success) {
          process.exit(1);
        }
      }
      
    } catch (error) {
      outputError(`Error resuming workflow: ${error instanceof Error ? error.message : error}`, isJsonMode);
    }
  });

program
  .command('cancel')
  .description('Cancel a workflow')
  .argument('<thread-id>', 'Thread ID of the workflow to cancel')
  .option('-f, --force', 'Force cancellation without confirmation', false)
  .action(async (threadId, options) => {
    const isJsonMode = program.getOptionValue('json');
    
    try {
      if (!validateThreadId(threadId)) {
        outputError('Invalid thread ID format. Expected UUID format.', isJsonMode);
        return;
      }

      const agent = await initializeAgent();
      
      // Get workflow info for confirmation
      const status = await agent.getWorkflowStatus(threadId);
      if (!status) {
        outputError('Workflow not found.', isJsonMode);
        return;
      }
      
      if (!options.force) {
        if (isJsonMode) {
          // In JSON mode, force must be used - no interactive confirmation
          outputError('Interactive confirmation not supported in JSON mode. Use --force flag.', isJsonMode);
          return;
        }
        
        const io = new CLIHandler();
        try {
          const confirm = await io.receiveInput(
            `Are you sure you want to cancel ${status.workflowType} workflow ${threadId.substring(0, 8)}...? (y/N)`,
            'user'
          );
          
          if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
            console.log('❌ Cancellation aborted.');
            return;
          }
        } finally {
          io.close();
        }
      }
      
      const success = await agent.cancelWorkflow(threadId);
      
      outputResult({
        success: success,
        message: success ? 'Workflow cancelled successfully' : 'Failed to cancel workflow'
      }, isJsonMode);
      
      if (!success) {
        process.exit(1);
      }
      
    } catch (error) {
      outputError(`Error cancelling workflow: ${error instanceof Error ? error.message : error}`, isJsonMode);
    }
  });

// Global error handler and cleanup
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  if (agent) {
    try {
      await agent.shutdown();
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Parse command line arguments
program.parse();