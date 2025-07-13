import { writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-node';
import {
  LoggingService,
  LogEntry,
  LogRequest
} from '@mealplanner/generated';
import { Timestamp } from '@bufbuild/protobuf';

let loggingClient: ReturnType<typeof createClient<typeof LoggingService>>;
let initialized = false;

export async function initLogging(_serviceName = 'agent') {
  if (initialized) return;
  const baseUrl = process.env.LOGGING_SERVICE_ADDR || 'http://localhost:50052';

  const transport = createConnectTransport({
    baseUrl,
    httpVersion: '1.1',
  });

  loggingClient = createClient(LoggingService, transport);

  try {
    // Test connection with a basic health check
    logToFile('INFO', `Successfully connected to logging service at ${baseUrl}`);
  } catch (error) {
    console.error(`[AGENT] Failed to connect to logging service: ${error}`);
    logToFile('ERROR', `Failed to connect to logging service: ${error}`);
    throw error;
  }

  initialized = true;
  sendLog('INFO', 'Agent logging initialized');
}

function logToFile(level: string, message: string) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level}] ${message}\n`;
  const debugLogPath = join(process.cwd(), 'cli-debug.log');
  try {
    appendFileSync(debugLogPath, logEntry);
  } catch {
    try {writeFileSync(debugLogPath, logEntry);} catch {/* ignore */}
  }
}

async function sendLog(level: string, message: string, fields: Record<string, string> = {}) {
  await initLogging();
  const entry = new LogEntry({
    serviceName: 'agent',
    level,
    message,
    timestamp: Timestamp.fromDate(new Date()),
    threadId: '',
    component: '',
    fields
  });

  logToFile(level, message); // Always log to file for backup

  if (!loggingClient) {
    console.error(`[AGENT] No logging client available`);
    return;
  }
  try {
    await loggingClient.log(new LogRequest({ entry }));
  } catch (error) {
    console.error(`[AGENT] Failed to send log to service:`, error);
  }
}

export function debugLog(message: string, fields: Record<string, string> = {}) {
  return sendLog('DEBUG', message, fields);
}

export function infoLog(message: string, fields: Record<string, string> = {}) {
  return sendLog('INFO', message, fields);
}

export function warnLog(message: string, fields: Record<string, string> = {}) {
  return sendLog('WARN', message, fields);
}

export function errorLog(message: string, fields: Record<string, string> = {}) {
  return sendLog('ERROR', message, fields);
}