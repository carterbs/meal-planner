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

// Step 1: Kill any existing processes on relevant ports
console.log(chalk.blue('🔍 Checking for existing processes...'));
killProcessOnPort(8080); // API Gateway
killProcessOnPort(9090); // Backend gRPC
killProcessOnPort(3000); // Frontend dev server

// Step 2: Build API Gateway if needed
console.log(chalk.blue('🔨 Building API Gateway...'));
try {
  execSync('go build -o gateway .', { 
    cwd: path.join(PROJECT_ROOT, 'go/api-gateway'),
    stdio: 'inherit'
  });
  console.log(chalk.green('✅ API Gateway built successfully'));
} catch (error) {
  console.error(chalk.red('❌ Failed to build API Gateway:'), error.message);
  process.exit(1);
}

// Step 3: Start the applications
console.log(chalk.blue('🚀 Starting frontend and backend applications...'));

// Start backend gRPC service first
const backendProcess = spawn('go', ['run', '.'], {
  cwd: path.join(PROJECT_ROOT, 'go'),
  stdio: 'inherit',
  shell: true,
});

// Start API Gateway after a short delay
setTimeout(() => {
  const gatewayProcess = spawn('./gateway', [], {
    cwd: path.join(PROJECT_ROOT, 'go/api-gateway'),
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PORT: '8080' },
  });

  // Handle gateway process events
  gatewayProcess.on('error', (error) => {
    console.error(chalk.red('❌ Failed to start API Gateway:'), error.message);
    process.exit(1);
  });

  gatewayProcess.on('close', (code) => {
    console.log(chalk.blue(`API Gateway exited with code ${code}`));
    process.exit(code);
  });
}, 2000); // Wait 2 seconds for backend gRPC to initialize

// Wait for both backend and gateway to be ready
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

  // Update cleanup to handle all processes
  process.on('SIGINT', () => {
    console.log(chalk.blue('\n🛑 Stopping application servers...'));
    try {
      backendProcess.kill('SIGINT');
      frontendProcess.kill('SIGINT');
      // Kill processes on ports as fallback
      execSync('node scripts/kill-servers.js', { cwd: PROJECT_ROOT, stdio: 'ignore' });
    } catch (error) {
      // Ignore cleanup errors
    }
    console.log(chalk.green('✅ Application servers stopped.'));
    process.exit(0);
  });
}, 5000); // Wait 5 seconds for backend + gateway to initialize

// Handle backend process events
backendProcess.on('error', (error) => {
  console.error(chalk.red('❌ Failed to start backend:'), error.message);
  process.exit(1);
});

backendProcess.on('close', (code) => {
  console.log(chalk.blue(`Backend exited with code ${code}`));
  process.exit(code);
});