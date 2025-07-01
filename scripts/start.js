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

// Step 1: Kill any existing processes on ports 8000 and 5000
console.log(chalk.blue('🔍 Checking for existing processes on ports 8000 and 5000...'));
killProcessOnPort(8000);
killProcessOnPort(5000);

// Step 2: Start the applications
console.log(chalk.blue('🚀 Starting frontend and backend applications...'));

// Start backend first
const backendProcess = spawn('go', ['run', 'main.go'], {
  cwd: path.join(PROJECT_ROOT, 'backend'),
  stdio: 'inherit',
  shell: true,
});

// Wait for backend to be ready (give it a few seconds)
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
  frontendProcess.kill('SIGINT');
  console.log(chalk.green('✅ Application servers stopped.'));
  process.exit(0);
});