// We'll create a simple HTTP client instead of importing the gRPC client
// to avoid TypeScript path issues
import { writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';
// import { LoggingClient } from '@mealplanner/logging-client';

let loggingClient: any | null = null;
let useGrpcLogging = false;

// Initialize gRPC logging
export function initLogging() {
  // Temporarily disable gRPC logging to test if it's causing the hang
  useGrpcLogging = false;
  // Don't log to stdout in JSON mode to avoid contaminating the output
  if (!process.argv.includes('--json')) {
    console.log(`gRPC logging disabled for testing`);
  }
  // try {
  //   const loggingServiceAddr = process.env.LOGGING_SERVICE_ADDR || 'localhost:50052';
  //   loggingClient = new LoggingClient(loggingServiceAddr, 'agent');
  //   useGrpcLogging = true;
  //   console.log(`gRPC logging service connected at ${loggingServiceAddr}`);
  // } catch (error) {
  //   console.warn(`gRPC logging service not available: ${error}`);
  //   useGrpcLogging = false;
  // }
}

// Enhanced debug logger that works in JSON mode and sends to gRPC service
export function debugLog(message: string, fields?: Record<string, string>) {
  const timestamp = new Date().toISOString();
  
  // Send to gRPC service if available
  if (useGrpcLogging && loggingClient) {
    loggingClient.debug(message, fields).catch((err: any) => {
      // Fallback to file logging if gRPC fails
      console.warn('gRPC logging failed, falling back to file:', err);
      logToFile(message, timestamp);
    });
  } else {
    // Fallback to file logging
    logToFile(message, timestamp);
  }
}

// Enhanced info logger
export function infoLog(message: string, fields?: Record<string, string>) {
  if (useGrpcLogging && loggingClient) {
    loggingClient.info(message, fields).catch((err: any) => {
      console.warn('gRPC logging failed:', err);
    });
  }
}

// Enhanced warn logger
export function warnLog(message: string, fields?: Record<string, string>) {
  if (useGrpcLogging && loggingClient) {
    loggingClient.warn(message, fields).catch((err: any) => {
      console.warn('gRPC logging failed:', err);
    });
  }
}

// Enhanced error logger
export function errorLog(message: string, fields?: Record<string, string>) {
  if (useGrpcLogging && loggingClient) {
    loggingClient.error(message, fields).catch((err: any) => {
      console.warn('gRPC logging failed:', err);
    });
  }
}

// Fallback file logging
function logToFile(message: string, timestamp: string) {
  const CURRENT_DIR = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  const debugLogPath = join(CURRENT_DIR, '..', 'cli-debug.log');
  const logEntry = `[${timestamp}] ${message}\n`;
  
  try {
    appendFileSync(debugLogPath, logEntry);
  } catch (err) {
    // If file doesn't exist, create it
    try {
      writeFileSync(debugLogPath, logEntry);
    } catch (createErr) {
      // Ignore logging errors to prevent blocking execution
    }
  }
}

// Initialize logging when module is imported
initLogging();