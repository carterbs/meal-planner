#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// Function to kill processes on specific ports (reused from start.js)
function killProcessOnPort(port) {
  try {
    // Check if any process is using the port
    const pids = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim();
    
    if (pids) {
      // Kill the processes
      execSync(`kill -9 ${pids.split('\n').join(' ')}`, { stdio: 'ignore' });
    }
  } catch (error) {
    // No process found on port, which is fine
  }
}

// Function to start database
function startDatabase() {
  try {
    execSync('docker-compose up -d db', { 
      cwd: PROJECT_ROOT,
      stdio: 'ignore'
    });
  } catch (error) {
    console.error('Failed to start database:', error.message);
    process.exit(1);
  }
}

// Function to build MCP server
function buildMCP() {
  try {
    execSync('yarn build', { 
      cwd: path.join(PROJECT_ROOT, 'backend/mcp'),
      stdio: 'ignore'
    });
  } catch (error) {
    console.error('Failed to build MCP server:', error.message);
    process.exit(1);
  }
}

// Function to start backend
function startBackend() {
  let goArgs = ['run', 'main.go'];
  if (process.argv.includes("--codex")) {
    goArgs.push('--dummy');
  }
  return spawn('go', goArgs, {
      cwd: path.join(PROJECT_ROOT, 'backend'),
      stdio: 'ignore',
      env: process.env
    });
}

// Step 1: Kill any existing processes on ports 8080 and 3001
killProcessOnPort(8080);
killProcessOnPort(3001);

// Step 2: Start database
startDatabase();

// Step 3: Build MCP server
buildMCP();

// Step 4: Start backend server
const backendProcess = startBackend();

// Step 5: Wait a moment for backend to start, then start MCP server
setTimeout(() => {
  try {
    const mcpProcess = spawn('yarn', [ 'start' ], {
      cwd: path.join(PROJECT_ROOT, 'backend/mcp'),
      stdio: 'inherit',
      env: {
        ...process.env,
        BACKEND_BASE_URL: 'http://localhost:8080',
      }
    });

    mcpProcess.on('error', (error) => {
      console.error('Failed to start MCP server:', error.message);
      backendProcess.kill('SIGINT');
      process.exit(1);
    });

    mcpProcess.on('close', (code) => {
      backendProcess.kill('SIGINT');
      process.exit(code);
    });

    process.on('SIGINT', () => {
      mcpProcess.kill('SIGINT');
      backendProcess.kill('SIGINT');
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start MCP server:', error.message);
    backendProcess.kill('SIGINT');
    process.exit(1);
  }
}, 2000); // Wait 2 seconds for backend to start