#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const chalk = require('chalk');
const path = require('path');
const waitOn = require('wait-on');
const fs = require('fs');

// Configuration
const POSTGRES_PORT = 5432;
const POSTGRES_HOST = 'localhost';
const MAX_DB_WAIT_TIME = 60000; // 60 seconds
const PROJECT_ROOT = path.resolve(__dirname, '..');

console.log(chalk.blue('🚀 Starting Meal Planner development environment...'));

// Function to check if Docker is running
function isDockerRunning() {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Function to check if containers are already running
function areContainersRunning() {
  try {
    const output = execSync('docker-compose ps -q', { 
      cwd: PROJECT_ROOT,
      encoding: 'utf8' 
    });
    return output.trim() !== '';
  } catch (error) {
    return false;
  }
}

// Function to check if PostgreSQL container specifically is running
function isPostgresRunning() {
  try {
    // Check if the 'db' service from docker-compose is running
    const output = execSync('docker-compose ps db --filter "status=running" -q', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8'
    });
    return output.trim() !== '';
  } catch (error) {
    return false;
  }
}

// Step 1: Check if Docker is running
if (!isDockerRunning()) {
  console.log(chalk.yellow('🐳 Docker is not running. Starting Docker...'));
  console.log(chalk.yellow('⚠️ Please start Docker manually and try again.'));
  process.exit(1);
}

// Step 2: Start Docker containers if not already running
if (!areContainersRunning()) {
  console.log(chalk.blue('🐳 Starting Docker containers...'));
  
  try {
    execSync('docker-compose up -d', { 
      cwd: PROJECT_ROOT,
      stdio: 'inherit' 
    });
    console.log(chalk.green('✅ Docker containers started successfully!'));
  } catch (error) {
    console.error(chalk.red('❌ Failed to start Docker containers:'), error.message);
    process.exit(1);
  }
} else {
  console.log(chalk.green('✅ Docker containers are already running.'));
}

// Step 3: Check if PostgreSQL container is running
if (!isPostgresRunning()) {
  console.log(chalk.yellow('⚠️ PostgreSQL container is not running. Attempting to start it...'));
  try {
    execSync('docker-compose up -d db', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit'
    });
    console.log(chalk.green('✅ PostgreSQL container started successfully!'));
  } catch (error) {
    console.error(chalk.red('❌ Failed to start PostgreSQL container:'), error.message);
    process.exit(1);
  }
}

// Step 4: Wait for PostgreSQL to be ready to accept connections
console.log(chalk.blue('⏳ Waiting for PostgreSQL to be ready to accept connections...'));

const dbCheckOptions = {
  resources: [`tcp:${POSTGRES_HOST}:${POSTGRES_PORT}`],
  delay: 1000,
  interval: 1000,
  timeout: MAX_DB_WAIT_TIME,
};

let postgresReady = false;
const waitTimer = setTimeout(() => {
  if (!postgresReady) {
    console.error(chalk.red('❌ Timed out waiting for PostgreSQL.'));
    console.log(chalk.yellow('💡 Try running `docker-compose down` and then `yarn dev` again.'));
    process.exit(1);
  }
}, MAX_DB_WAIT_TIME);

waitOn(dbCheckOptions)
  .then(() => {
    postgresReady = true;
    clearTimeout(waitTimer);
    console.log(chalk.green('✅ PostgreSQL is ready!'));
    startApp();
  })
  .catch(err => {
    postgresReady = true;
    clearTimeout(waitTimer);
    console.error(chalk.red('❌ Error waiting for PostgreSQL:'), err.message);
    console.log(chalk.yellow('💡 If the application fails, try running `docker-compose down` and then `yarn dev` again.'));
    console.log(chalk.yellow('🔄 Attempting to continue anyway...'));
    startApp();
  });

// Step 5: Start the application (frontend and backend)
function startApp() {
  console.log(chalk.blue('🚀 Starting frontend and backend applications...'));
  
  // Check if any process is already using port 3000 (frontend)
  try {
    execSync('lsof -i:3000 -t', { stdio: 'ignore' });
    console.log(chalk.yellow('⚠️ Warning: Port 3000 is already in use. Frontend may fail to start.'));
  } catch (error) {
    // No process is using port 3000, which is good
  }

  // Start the application using the existing 'start' script
  const startProcess = spawn('yarn', ['start'], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    shell: true,
  });

  startProcess.on('error', (error) => {
    console.error(chalk.red('❌ Failed to start application:'), error.message);
    process.exit(1);
  });

  // Handle CTRL+C gracefully
  process.on('SIGINT', () => {
    console.log(chalk.blue('\n🛑 Stopping development environment...'));
    startProcess.kill();
    console.log(chalk.green('✅ Development servers stopped.'));
    
    // Ask if user wants to stop Docker containers too
    console.log(chalk.yellow('Would you like to stop Docker containers as well? (y/n)'));
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (data) => {
      const key = data.toString().toLowerCase();
      if (key === 'y') {
        try {
          console.log(chalk.blue('🐳 Stopping Docker containers...'));
          execSync('docker-compose down', { 
            cwd: PROJECT_ROOT,
            stdio: 'inherit' 
          });
          console.log(chalk.green('✅ Docker containers stopped successfully!'));
        } catch (error) {
          console.error(chalk.red('❌ Failed to stop Docker containers:'), error.message);
        }
      }
      process.exit(0);
    });
  });
}
