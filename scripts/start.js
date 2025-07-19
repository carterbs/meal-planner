#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const chalk = require('chalk');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

console.log(chalk.blue('🚀 Starting Meal Planner application...'));

// Function to kill processes on specific ports
function killProcessOnPort(port) {
  try {
    // Check if any process is using the port
    const pids = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim();
    
    if (pids) {
      console.log(chalk.yellow(`⚠️ Found process(es) on port ${port}. Killing...`));
      
      // Kill the processes
      execSync(`kill -9 ${pids.split('\n').join(' ')}`, { stdio: 'ignore' });
      console.log(chalk.green(`✅ Killed process(es) on port ${port}`));
    }
  } catch (error) {
    // No process found on port, which is fine
    console.log(chalk.gray(`ℹ️ No process found on port ${port}`));
  }
}

// Step 1: Kill any existing processes on ports 8080, 8090, and 5000
console.log(chalk.blue('🔍 Checking for existing processes on ports 8080, 8090, and 5000...'));
killProcessOnPort(8080);
killProcessOnPort(8090);
killProcessOnPort(5000);

// Kill logging service port
console.log(chalk.blue('🔍 Checking for existing processes on port 50052 (logging service)...'));
killProcessOnPort(50052);

// Kill agent service port
console.log(chalk.blue('🔍 Checking for existing processes on port 50053 (agent service)...'));
killProcessOnPort(50053);

// Build services first
console.log(chalk.blue('🔨 Building MCP server...'));
try {
  execSync('yarn build', { cwd: path.join(PROJECT_ROOT, 'mcp-service'), stdio: 'inherit' });
  console.log(chalk.green('✅ MCP server built'));
} catch (error) {
  console.error(chalk.red('❌ Failed to build MCP server:'), error.message);
  process.exit(1);
}

console.log(chalk.blue('🔨 Building agent service...'));
try {
  execSync('yarn build', { cwd: path.join(PROJECT_ROOT, 'agent-service'), stdio: 'inherit' });
  console.log(chalk.green('✅ Agent service built'));
} catch (error) {
  console.error(chalk.red('❌ Failed to build agent service:'), error.message);
  process.exit(1);
}

// Step 2: Start services in the correct order (matching e2e test)
let loggingProcess, backendProcess, gatewayProcess, mcpProcess, agentProcess, frontendProcess;

// Start logging service first
console.log(chalk.blue('🚀 Starting logging service...'));
loggingProcess = spawn('go', ['run', '.'], {
  cwd: path.join(PROJECT_ROOT, 'logging-service'),
  stdio: 'inherit',
  shell: true,
});

// Start backend
console.log(chalk.blue('🚀 Starting backend...'));
backendProcess = spawn('go', ['run', '.'], {
  cwd: path.join(PROJECT_ROOT, 'meal-service'),
  stdio: 'inherit',
  shell: true,
});

// Start API gateway
console.log(chalk.blue('🚀 Starting API gateway...'));
gatewayProcess = spawn('go', ['run', '.'], {
  cwd: path.join(PROJECT_ROOT, 'api-gateway'),
  stdio: 'inherit',
  shell: true,
});

// Start MCP server
console.log(chalk.blue('🚀 Starting MCP server...'));
mcpProcess = spawn('yarn', ['start:mcp'], {
  cwd: PROJECT_ROOT,
  stdio: 'inherit',
  shell: true,
});

// Start agent service
console.log(chalk.blue('🚀 Starting agent service...'));
agentProcess = spawn('yarn', ['start:grpc'], {
  cwd: PROJECT_ROOT,
  stdio: 'inherit',
  shell: true,
});

// Wait a bit for all services to initialize, then start frontend
setTimeout(() => {
  console.log(chalk.blue('🚀 Starting frontend...'));
  frontendProcess = spawn('yarn', ['start'], {
    cwd: path.join(PROJECT_ROOT, 'ui'),
    stdio: 'inherit',
    shell: true,
  });

  // Handle frontend process events
  frontendProcess.on('error', (error) => {
    console.error(chalk.red('❌ Failed to start frontend:'), error.message);
    process.exit(1);
  });

  frontendProcess.on('close', (code) => {
    console.log(chalk.blue(`Frontend exited with code ${code}`));
    process.exit(code);
  });
}, 5000); // Wait 5 seconds for all backend services to initialize

// Handle process events
loggingProcess.on('error', (error) => {
  console.error(chalk.red('❌ Failed to start logging service:'), error.message);
  process.exit(1);
});
loggingProcess.on('close', (code) => {
  console.log(chalk.blue(`Logging service exited with code ${code}`));
  process.exit(code);
});

backendProcess.on('error', (error) => {
  console.error(chalk.red('❌ Failed to start backend:'), error.message);
  process.exit(1);
});
backendProcess.on('close', (code) => {
  console.log(chalk.blue(`Backend exited with code ${code}`));
  process.exit(code);
});

gatewayProcess.on('error', (error) => {
  console.error(chalk.red('❌ Failed to start API gateway:'), error.message);
  process.exit(1);
});
gatewayProcess.on('close', (code) => {
  console.log(chalk.blue(`API gateway exited with code ${code}`));
  process.exit(code);
});

mcpProcess.on('error', (error) => {
  console.error(chalk.red('❌ Failed to start MCP server:'), error.message);
  process.exit(1);
});
mcpProcess.on('close', (code) => {
  console.log(chalk.blue(`MCP server exited with code ${code}`));
  process.exit(code);
});

agentProcess.on('error', (error) => {
  console.error(chalk.red('❌ Failed to start agent service:'), error.message);
  process.exit(1);
});
agentProcess.on('close', (code) => {
  console.log(chalk.blue(`Agent service exited with code ${code}`));
  process.exit(code);
});

// Handle CTRL+C gracefully
process.on('SIGINT', () => {
  console.log(chalk.blue('\n🛑 Stopping application servers...'));
  if (loggingProcess) loggingProcess.kill('SIGINT');
  if (backendProcess) backendProcess.kill('SIGINT');
  if (gatewayProcess) gatewayProcess.kill('SIGINT');
  if (mcpProcess) mcpProcess.kill('SIGINT');
  if (agentProcess) agentProcess.kill('SIGINT');
  if (frontendProcess) frontendProcess.kill('SIGINT');
  console.log(chalk.green('✅ Application servers stopped.'));
  process.exit(0);
});