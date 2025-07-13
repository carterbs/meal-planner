import { writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import { ChannelCredentials, Metadata, Client } from '@grpc/grpc-js';
import {
  LoggingServiceClientImpl,
  LogEntry,
  LoggingServiceServiceName,
} from '@mealplanner/generated';

let rpcClient: Client;
let loggingService: LoggingServiceClientImpl;
let initialized = false;

export async function initLogging(serviceName = 'mcp-server') {
  if (initialized) return;
  const addr = process.env.LOGGING_SERVICE_ADDR || 'localhost:50052';
  console.log(`[MCP] Initializing logging to ${addr}`);
  
  rpcClient = new Client(addr, ChannelCredentials.createInsecure(), {
    'grpc.max_receive_message_length': -1,
    'grpc.max_send_message_length': -1,
  });
  
  // store promise to resolve when rpc is ready
  await new Promise<void>((resolve, reject) => {
    rpcClient.waitForReady(Date.now() + 500, (error) => {
      if (error) {
        console.error(`[MCP] Failed to connect to logging service: ${error.message}`);
        logToFile('ERROR', `Failed to connect to logging service: ${error.message}`);
        reject(error);
      } else {
        console.log(`[MCP] Successfully connected to logging service at ${addr}`);
        logToFile('INFO', `Successfully connected to logging service at ${addr}`);
        resolve();
      }
    });
  });
  
  const rpc = {
    request: (svc: string, method: string, data: Uint8Array): Promise<Uint8Array> => {
      return new Promise((resolve, reject) => {
        console.log(`[MCP] Making gRPC request: ${svc}/${method}`);
        const metadata = new Metadata();
        metadata.add('service-name', serviceName);
        
        // Add a timeout
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 5);
        
        rpcClient.makeUnaryRequest(
          `/${svc}/${method}`,
          (arg) => Buffer.from(arg),
          (buf: Buffer) => buf,
          data,
          metadata,
          { deadline },
          (err, resp) => {
            if (err) {
              console.error(`[MCP] gRPC request failed: ${err.message}, code: ${err.code}, details: ${err.details}`);
              return reject(err);
            }
            if (!resp) {
              console.error(`[MCP] gRPC request returned no response`);
              return reject(new Error('no response'));
            }
            console.log(`[MCP] gRPC request successful`);
            resolve(new Uint8Array(resp));
          }
        );
      });
    },
  };
  loggingService = new LoggingServiceClientImpl(rpc, {
    service: LoggingServiceServiceName,
  });
  initialized = true;
  console.log(`[MCP] Logging service client initialized`);
  sendLog('INFO', 'MCP server logging initialized');
}

function logToFile(level: string, message: string) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level}] ${message}\n`;
  const debugLogPath = join(process.cwd(), 'mcp-debug.log');
  try {
    appendFileSync(debugLogPath, logEntry);
  } catch {
    try { writeFileSync(debugLogPath, logEntry); } catch { /* ignore */ }
  }
}

async function sendLog(level: string, message: string, fields: Record<string, string> = {}) {
  await initLogging();
  const entry: LogEntry = {
    serviceName: 'mcp-server',
    level,
    message,
    timestamp: new Date(),
    threadId: '',
    component: '',
    fields,
  };
  
  console.log(`[MCP] Attempting to send log: ${level} - ${message}`);
  logToFile(level, message); // Always log to file for backup
  
  if (!loggingService) {
    console.error(`[MCP] No logging service available`);
    return;
  }
  try {
    console.log(`[MCP] Calling loggingService.Log with entry:`, JSON.stringify(entry, null, 2));
    const response = await loggingService.Log({ entry });
    console.log(`[MCP] Log sent successfully:`, response);
  } catch (error) {
    console.error(`[MCP] Failed to send log to service:`, error);
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