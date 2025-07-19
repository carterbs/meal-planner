#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// Function to kill processes on specific ports
function killProcessOnPort(port) {
  try {
    const pids = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim();
    if (pids) {
      execSync(`kill -9 ${pids.split('\n').join(' ')}`, { stdio: 'ignore' });
    }
  } catch (error) {
    // No process found on port, which is fine
  }
}

// Function to build MCP server
function buildMCP() {
  try {
    execSync('yarn build', { 
      cwd: path.join(PROJECT_ROOT, 'mcp-service'),
      stdio: 'ignore'
    });
  } catch (error) {
    console.error('Failed to build MCP server:', error.message);
    process.exit(1);
  }
}

// Function to start MCP server
function startMCPServer() {
  return spawn('node', ['dist/index.js'], {
    cwd: path.join(PROJECT_ROOT, 'mcp-service'),
    stdio: 'inherit',
    env: {
      ...process.env,
      BACKEND_BASE_URL: 'http://127.0.0.1:8080',
      MCP_PORT: '3001',
    }
  });
}

// Step 1: Kill any existing processes on port 3001
killProcessOnPort(3001);

// Step 2: Build MCP server
console.log('🔨 Building MCP server...');
buildMCP();

// Step 3: Start MCP server
console.log('🚀 Starting MCP server...');
const mcpProcess = startMCPServer();

mcpProcess.on('error', (error) => {
  console.error('Failed to start MCP server:', error.message);
  process.exit(1);
});

mcpProcess.on('close', (code) => {
  console.log(`MCP process exited with code ${code}`);
  process.exit(code);
});

// Handle shutdown signals
process.on('SIGINT', () => {
  console.log('Shutting down MCP server...');
  mcpProcess.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down MCP server...');
  mcpProcess.kill('SIGTERM');
  process.exit(0);
});