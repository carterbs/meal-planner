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

// Start logging service
console.log(chalk.blue('🚀 Starting logging service...'));
const loggingProcess = spawn('go', ['run', 'main.go'], {
  cwd: path.join(PROJECT_ROOT, 'logging-service'),
  stdio: 'inherit',
  shell: true,
});

// Start agent service
console.log(chalk.blue('🚀 Starting agent service...'));
const agentProcess = spawn('yarn', ['start:grpc'], {
  cwd: path.join(PROJECT_ROOT, 'agent-service'),
  stdio: 'inherit',
  shell: true,
});

// Handle logging process events
loggingProcess.on('error', (error) => {
  console.error(chalk.red('❌ Failed to start logging service:'), error.message);
  process.exit(1);
});
loggingProcess.on('close', (code) => {
  console.log(chalk.blue(`Logging service exited with code ${code}`));
  process.exit(code);
});

// Handle agent process events
agentProcess.on('error', (error) => {
  console.error(chalk.red('❌ Failed to start agent service:'), error.message);
  process.exit(1);
});
agentProcess.on('close', (code) => {
  console.log(chalk.blue(`Agent service exited with code ${code}`));
  process.exit(code);
});

// Build MCP server
console.log(chalk.blue('🔨 Building MCP server...'));
try {
  execSync('yarn build', { cwd: path.join(PROJECT_ROOT, 'typescript', 'mcp'), stdio: 'inherit' });
  console.log(chalk.green('✅ MCP server built'));
} catch (error) {
  console.error(chalk.red('❌ Failed to build MCP server:'), error.message);
  process.exit(1);
}

// Build agent service
console.log(chalk.blue('🔨 Building agent service...'));
try {
  execSync('yarn build', { cwd: path.join(PROJECT_ROOT, 'agent-service'), stdio: 'inherit' });
  console.log(chalk.green('✅ Agent service built'));
} catch (error) {
  console.error(chalk.red('❌ Failed to build agent service:'), error.message);
  process.exit(1);
}

// Step 2: Start the applications
console.log(chalk.blue('🚀 Starting backend, API gateway, and frontend...'));

// Start backend first (on 8090)
const backendProcess = spawn('go', ['run', '.'], {
  cwd: path.join(PROJECT_ROOT, 'meal-service'),
  stdio: 'inherit',
  shell: true,
});

// Wait for backend to be ready, then start API gateway
setTimeout(() => {
  // Start API gateway (on 8080)
  const gatewayProcess = spawn('go', ['run', '.'], {
    cwd: path.join(PROJECT_ROOT, 'api-gateway'),
    stdio: 'inherit',
    shell: true,
  });

  // Wait a bit more for gateway, then start frontend
  setTimeout(() => {
    // Then start frontend
    const frontendProcess = spawn('yarn', ['start'], {
      cwd: path.join(PROJECT_ROOT, 'typescript/ui'),
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
  }, 2000); // Wait 2 seconds for gateway to initialize

  // Handle gateway process events
  gatewayProcess.on('error', (error) => {
    console.error(chalk.red('❌ Failed to start API gateway:'), error.message);
    process.exit(1);
  });

  gatewayProcess.on('close', (code) => {
    console.log(chalk.blue(`API gateway exited with code ${code}`));
    process.exit(code);
  });
}, 3000); // Wait 3 seconds for backend to initialize

// Handle backend process events
backendProcess.on('error', (error) => {
  console.error(chalk.red('❌ Failed to start backend:'), error.message);
  process.exit(1);
});

backendProcess.on('close', (code) => {
  console.log(chalk.blue(`Backend exited with code ${code}`));
  process.exit(code);
});

// Handle CTRL+C gracefully
process.on('SIGINT', () => {
  console.log(chalk.blue('\n🛑 Stopping application servers...'));
  backendProcess.kill('SIGINT');
  if (typeof loggingProcess !== 'undefined') loggingProcess.kill('SIGINT');
  if (typeof agentProcess !== 'undefined') agentProcess.kill('SIGINT');
  if (typeof gatewayProcess !== 'undefined') gatewayProcess.kill('SIGINT');
  if (typeof frontendProcess !== 'undefined') frontendProcess.kill('SIGINT');
  console.log(chalk.green('✅ Application servers stopped.'));
  process.exit(0);
});