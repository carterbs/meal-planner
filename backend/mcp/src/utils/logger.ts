import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'mcp-server.log');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Create a write stream (in append mode)
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

// Override console methods to write to both console and file
const originalConsole = { ...console };

function logWithTimestamp(...args: any[]) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // Write to file
  logStream.write(logMessage);
  
  // Write to original console
  originalConsole.log(logMessage.trim());
}

// Override console methods
console.log = (...args) => logWithTimestamp('[INFO]', ...args);
console.error = (...args) => {
  const errorMessage = args.map(arg => 
    arg instanceof Error ? `${arg.message}\n${arg.stack}` : String(arg)
  ).join(' ');
  logWithTimestamp('[ERROR]', errorMessage);
};
console.warn = (...args) => logWithTimestamp('[WARN]', ...args);
console.info = (...args) => logWithTimestamp('[INFO]', ...args);
console.debug = (...args) => logWithTimestamp('[DEBUG]', ...args);

// Handle process termination
process.on('exit', () => {
  logStream.end();
});

process.on('SIGINT', () => {
  logStream.end();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  logStream.end();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  logStream.end();
  process.exit(1);
});

export {};
