#!/usr/bin/env node

// Load environment variables FIRST before any other imports
import { config as dotenvConfig } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// In built version, we're in dist/ so go up one level to agent/
const envPath = join(__dirname, '..', '.env');
const result = dotenvConfig({ path: envPath });

// Debug environment loading (only in non-JSON mode)
if (!process.argv.includes('--json')) {
  console.log(`📧 [ENV] Loading from: ${envPath}`);
  console.log(`📧 [ENV] Result:`, result.error ? `Error: ${result.error}` : 'Success');
  console.log(`📧 [ENV] OPENAI_API_KEY present:`, !!process.env.OPENAI_API_KEY);
}

// Now import everything else
import { Command } from 'commander';
import { LangGraphAgent, LangGraphAgentConfig } from './langgraph-agent.js';
import { WorkflowType } from './shared/types.js';
import { CLIHandler } from './io/cliHandler.js';
import { formatMealPlan } from './utils/formatMealPlan.js';
import { spawnSync } from 'child_process';

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
    console.log(JSON.stringify({ success: false, message }));
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
      
      outputResult({
        success: true,
        message: 'Meal planning session started',
        threadId: threadId,
        currentStep: 'started'
      }, isJsonMode);
      
      if (!isJsonMode) {
        console.log(`   Use: meal-agent plan feedback "${threadId}" "your feedback here"`);
        console.log(`   Or:  meal-agent resume ${threadId}`);
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
        
        if (!isJsonMode) {
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
        const result = await agent.resumeWorkflow(threadId);
        
        outputResult({
          success: result.success,
          message: result.success ? 'Workflow resumed successfully' : `Failed to resume workflow: ${result.message}`,
          currentStep: result.currentStep,
          raw: result
        }, isJsonMode);
        
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