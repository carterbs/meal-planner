#!/usr/bin/env node

/**
 * Test Workflow Script
 * 
 * A comprehensive tool for testing workflow finalization processes.
 * Supports sending messages, resetting workflow state, and extracting logs.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Try to import fetch, fallback to node-fetch if needed
let fetch;
try {
  fetch = globalThis.fetch;
} catch (e) {
  try {
    fetch = require('node-fetch');
  } catch (e2) {
    console.error('Neither native fetch nor node-fetch available. Please install node-fetch: npm install node-fetch');
    process.exit(1);
  }
}

// Configuration
const DEFAULT_THREAD_ID = '336509b3-1c3b-4134-a912-b6a081b1d0ed';
const DEFAULT_API_GATEWAY = 'http://localhost:8090';
const UNIFIED_LOG_PATH = './logging-service/logs/unified.log';

class WorkflowTester {
  constructor(options = {}) {
    this.threadId = options.threadId || DEFAULT_THREAD_ID;
    this.apiGateway = options.apiGateway || DEFAULT_API_GATEWAY;
    this.verbose = options.verbose || false;
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
  }

  error(message) {
    this.log(message, 'ERROR');
  }

  success(message) {
    this.log(message, 'SUCCESS');
  }

  /**
   * Execute a docker command and return the result
   */
  async execDocker(command, args = []) {
    return new Promise((resolve, reject) => {
      const cmdArgs = args.length > 0 ? args : command.split(' ');
      const proc = spawn('docker', cmdArgs, { 
        stdio: ['pipe', 'pipe', 'pipe'] 
      });
      
      let stdout = '';
      let stderr = '';
      
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Docker command failed: ${stderr}`));
        }
      });
    });
  }

  /**
   * Send a message to the workflow
   */
  async sendMessage(message = "Plan looks great.") {
    this.log(`Sending message to workflow ${this.threadId}: "${message}"`);
    
    try {
      const response = await fetch(`${this.apiGateway}/api/agent/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threadId: this.threadId,
          message: message,
          from: 'test-script'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      this.success(`Message sent successfully`);
      
      if (this.verbose) {
        console.log('Response:', JSON.stringify(result, null, 2));
      } else {
        this.log(`Response: success=${result.response?.success}, currentStep=${result.response?.currentStep}`);
      }
      
      return result;
    } catch (error) {
      this.error(`Failed to send message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reset workflow state to await_feedback
   */
  async resetWorkflow() {
    this.log(`Resetting workflow ${this.threadId} to await_feedback state`);
    
    const sql = `UPDATE workflow_checkpoints SET checkpoint_data = jsonb_set(jsonb_set(checkpoint_data, '{state,currentStep}', '"await_feedback"'), '{state,isFinalized}', 'false') WHERE thread_id = '${this.threadId}';`;

    try {
      const args = ['exec', 'meal-planner-db-1', 'psql', '-U', 'mealuser', '-d', 'mealplanner', '-c', sql];
      const result = await this.execDocker('', args);
      
      if (result.includes('UPDATE')) {
        const updateCount = result.match(/UPDATE (\d+)/)?.[1] || '0';
        this.success(`Reset ${updateCount} checkpoint records for workflow`);
      } else {
        this.error(`Unexpected database response: ${result}`);
      }

      // Restart agent service to clear in-memory cache
      this.log('Restarting agent service to clear workflow cache...');
      await this.execDocker('compose restart agent-service');
      
      // Wait for services to be healthy
      await this.waitForHealthy();
      this.success('Workflow state reset complete');
      
    } catch (error) {
      this.error(`Failed to reset workflow: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract logs from unified.log file
   */
  async getLogs(since = '5m') {
    this.log(`Extracting logs for thread ${this.threadId} since ${since} ago`);
    
    try {
      // Calculate timestamp for filtering
      const sinceMs = this.parseTimespan(since);
      const sinceTimestamp = new Date(Date.now() - sinceMs);
      
      if (!fs.existsSync(UNIFIED_LOG_PATH)) {
        this.error(`Log file not found: ${UNIFIED_LOG_PATH}`);
        return;
      }

      const logContent = fs.readFileSync(UNIFIED_LOG_PATH, 'utf8');
      const lines = logContent.split('\n');
      
      const relevantLogs = lines
        .filter(line => {
          if (!line.trim()) return false;
          
          try {
            const logEntry = JSON.parse(line);
            const logTime = new Date(logEntry.timestamp);
            
            // Filter by timestamp and thread relevance
            const isRecent = logTime >= sinceTimestamp;
            const isRelevant = 
              line.includes(this.threadId) ||
              line.includes('FINALIZE') ||
              line.includes('finalize') ||
              line.includes('MCP-FINALIZE') ||
              line.includes('GATEWAY-FINALIZE') ||
              line.includes('mealplan/finalize');
            
            return isRecent && isRelevant;
          } catch (e) {
            // If JSON parsing fails, check for string matches
            return line.includes(this.threadId) || line.includes('FINALIZE');
          }
        })
        .sort((a, b) => {
          try {
            const timeA = new Date(JSON.parse(a).timestamp);
            const timeB = new Date(JSON.parse(b).timestamp);
            return timeA - timeB;
          } catch (e) {
            return 0;
          }
        });

      if (relevantLogs.length === 0) {
        this.log('No relevant logs found');
        return;
      }

      this.success(`Found ${relevantLogs.length} relevant log entries:`);
      console.log('\n' + '='.repeat(80));
      console.log('RELEVANT LOGS');
      console.log('='.repeat(80));
      
      relevantLogs.forEach((line, index) => {
        try {
          const logEntry = JSON.parse(line);
          console.log(`${index + 1}. [${logEntry.timestamp}] [${logEntry.service}] ${logEntry.message}`);
        } catch (e) {
          console.log(`${index + 1}. ${line}`);
        }
      });
      
      console.log('='.repeat(80) + '\n');
      
    } catch (error) {
      this.error(`Failed to extract logs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get docker-compose logs for specific services
   */
  async getDockerLogs(since = '5m') {
    this.log(`Getting docker-compose logs since ${since} ago`);
    
    const services = ['agent-service', 'mcp-service', 'api-gateway'];
    
    for (const service of services) {
      try {
        this.log(`--- ${service.toUpperCase()} LOGS ---`);
        const command = `compose logs ${service} --since=${since}`;
        const logs = await this.execDocker(command);
        
        if (logs.trim()) {
          console.log(logs);
        } else {
          this.log(`No logs for ${service}`);
        }
        console.log('');
      } catch (error) {
        this.error(`Failed to get logs for ${service}: ${error.message}`);
      }
    }
  }

  /**
   * Wait for API gateway to be healthy
   */
  async waitForHealthy(maxAttempts = 30, intervalMs = 1000) {
    this.log('Waiting for API gateway to be healthy...');
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(`${this.apiGateway}/api/health`, {
          timeout: 5000
        });
        
        if (response.ok) {
          const healthData = await response.json();
          if (healthData.status === 'ok') {
            this.success(`API gateway healthy after ${attempt} attempts`);
            return;
          }
        }
      } catch (error) {
        // Service not ready yet, continue waiting
      }
      
      if (attempt < maxAttempts) {
        process.stdout.write('.');
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
    
    throw new Error(`API gateway did not become healthy after ${maxAttempts} attempts`);
  }

  /**
   * Parse timespan string (e.g., '5m', '1h', '30s') to milliseconds
   */
  parseTimespan(timespan) {
    const match = timespan.match(/^(\d+)([smh])$/);
    if (!match) {
      throw new Error(`Invalid timespan format: ${timespan}. Use format like '5m', '1h', '30s'`);
    }
    
    const [, amount, unit] = match;
    const multipliers = { s: 1000, m: 60000, h: 3600000 };
    
    return parseInt(amount) * multipliers[unit];
  }

  /**
   * Run a full test cycle
   */
  async testFinalize() {
    this.log('Starting full test cycle...');
    
    try {
      // Step 1: Reset workflow
      await this.resetWorkflow();
      
      // Step 2: Send finalize message
      await this.sendMessage('finalize the plan');
      
      // Step 3: Wait a moment for processing
      this.log('Waiting 3 seconds for processing...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Step 4: Extract logs
      await this.getLogs('1m');
      await this.getDockerLogs('1m');
      
      this.success('Test cycle complete!');
      
    } catch (error) {
      this.error(`Test cycle failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check workflow status
   */
  async getWorkflowStatus() {
    this.log(`Checking status of workflow ${this.threadId}`);
    
    const sql = `SELECT thread_id, checkpoint_ns, checkpoint_data->'state'->>'currentStep' as current_step, checkpoint_data->'state'->>'isFinalized' as is_finalized FROM workflow_checkpoints WHERE thread_id = '${this.threadId}' AND checkpoint_ns = 'latest';`;

    try {
      const args = ['exec', 'meal-planner-db-1', 'psql', '-U', 'mealuser', '-d', 'mealplanner', '-c', sql];
      const result = await this.execDocker('', args);
      
      console.log('\nWorkflow Status:');
      console.log(result);
      console.log('');
      
    } catch (error) {
      this.error(`Failed to get workflow status: ${error.message}`);
      throw error;
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  // Parse options
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    threadId: getOption(args, '--thread-id') || DEFAULT_THREAD_ID,
    apiGateway: getOption(args, '--api-gateway') || DEFAULT_API_GATEWAY,
  };
  
  const tester = new WorkflowTester(options);
  
  try {
    switch (command) {
      case 'send-message':
        const message = args[1] || "Plan looks great.";
        await tester.sendMessage(message);
        break;
        
      case 'reset-workflow':
        await tester.resetWorkflow();
        break;
        
      case 'get-logs':
        const since = args[1] || '5m';
        await tester.getLogs(since);
        break;
        
      case 'docker-logs':
        const dockerSince = args[1] || '5m';
        await tester.getDockerLogs(dockerSince);
        break;
        
      case 'status':
        await tester.getWorkflowStatus();
        break;
        
      case 'test-finalize':
        await tester.testFinalize();
        break;
        
      default:
        showUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error(`\nCommand failed: ${error.message}`);
    process.exit(1);
  }
}

function getOption(args, optionName) {
  const index = args.indexOf(optionName);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : null;
}

function showUsage() {
  console.log(`
Usage: ./test-workflow.js <command> [options]

Commands:
  send-message [message]     Send message to workflow (default: "Plan looks great.")
  reset-workflow            Reset workflow to await_feedback state
  get-logs [since]          Get logs from unified.log (default: 5m)
  docker-logs [since]       Get docker-compose logs (default: 5m)
  status                    Check workflow status
  test-finalize             Full test cycle: reset -> send message -> get logs

Options:
  --thread-id <id>          Thread ID (default: ${DEFAULT_THREAD_ID})
  --api-gateway <url>       API Gateway URL (default: ${DEFAULT_API_GATEWAY})
  --verbose, -v             Verbose output

Examples:
  ./test-workflow.js reset-workflow
  ./test-workflow.js send-message "finalize the plan"
  ./test-workflow.js get-logs 2m
  ./test-workflow.js test-finalize --verbose
  ./test-workflow.js status
`);
}

// Make script executable
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { WorkflowTester };