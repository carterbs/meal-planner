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
      cwd: path.join(PROJECT_ROOT, 'typescript/mcp'),
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

// Ensure logs directory exists
const logsDir = path.join(PROJECT_ROOT, 'typescript/mcp/logs');
if (!require('fs').existsSync(logsDir)) {
  require('fs').mkdirSync(logsDir, { recursive: true });
}

// Step 5: Wait a moment for backend to start, then start MCP server
setTimeout(() => {
  try {
    const logFile = path.join(logsDir, 'mcp-console.log');
    const logStream = require('fs').createWriteStream(logFile, { flags: 'a' });
    
    console.log(`📝 MCP server logs will be written to: ${logFile}`);
    
    // Create a PassThrough stream to duplicate the output
    const { PassThrough } = require('stream');
    const stdoutPass = new PassThrough();
    const stderrPass = new PassThrough();
    
    // Log function for captured output
    const logOutput = (source, data) => {
      const timestamp = new Date().toISOString();
      const logLine = `[${timestamp}] [${source}] ${data}`;
      logStream.write(logLine);
    };
    
    // Create the process with inherit for console output
    const mcpProcess = spawn('node', ['dist/index.js'], {
      cwd: path.join(PROJECT_ROOT, 'typescript/mcp'),
      stdio: ['inherit', 'pipe', 'pipe'],
      env: {
        ...process.env,
        BACKEND_BASE_URL: 'http://localhost:8080',
      }
    });
    
    // Pipe stdout/stderr to both the console and our log file
    mcpProcess.stdout.pipe(process.stdout);
    mcpProcess.stderr.pipe(process.stderr);
    
    // Also capture the output for logging
    mcpProcess.stdout.on('data', (data) => logOutput('stdout', data));
    mcpProcess.stderr.on('data', (data) => logOutput('stderr', data));

    mcpProcess.on('error', (error) => {
      console.error('Failed to start MCP server:', error.message);
      backendProcess.kill('SIGINT');
      process.exit(1);
    });

    mcpProcess.on('close', (code) => {
      console.log(`MCP process exited with code ${code}`);
      logStream.end();
      backendProcess.kill('SIGINT');
      process.exit(code);
    });
    
    process.on('SIGINT', () => {
      console.log('Shutting down MCP server...');
      mcpProcess.kill('SIGINT');
      logStream.end();
      backendProcess.kill('SIGINT');
      process.exit(0);
    });

    process.on('SIGINT', () => {
      mcpProcess.kill('SIGINT');
      backendProcess.kill('SIGINT');
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start MCP server:', error);
    if (logStream) logStream.end();
    backendProcess.kill('SIGINT');
    process.exit(1);
  }
}, 2000); // Wait 2 seconds for backend to start