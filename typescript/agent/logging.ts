import { writeFileSync, appendFileSync } from 'fs';


import { join } from 'path';
import { ChannelCredentials, Metadata, Client } from '@grpc/grpc-js';
import {
  LoggingServiceClientImpl,
  LogEntry,
  LoggingServiceServiceName } from
'@mealplanner/generated';

let rpcClient: Client;
let loggingService: LoggingServiceClientImpl;
let initialized = false;

export async function initLogging(serviceName = 'agent') {
  if (initialized) return;
  const addr = process.env.LOGGING_SERVICE_ADDR || 'localhost:50052';

  rpcClient = new Client(addr, ChannelCredentials.createInsecure(), {
    'grpc.max_receive_message_length': -1,
    'grpc.max_send_message_length': -1
  });

  // Add connection event listeners for debugging


  // store promise to resolve when rpc is ready
  await new Promise<void>((resolve, reject) => {
    rpcClient.waitForReady(Date.now() + 500, (error) => {
      if (error) {
        console.error(`[AGENT] Failed to connect to logging service: ${error.message}`);
        logToFile('ERROR', `Failed to connect to logging service: ${error.message}`);
        reject(error);
      } else {
        logToFile('INFO', `Successfully connected to logging service at ${addr}`);
        resolve();
      }
    });
  });

  const rpc = {
    request: (svc: string, method: string, data: Uint8Array): Promise<Uint8Array> => {
      return new Promise((resolve, reject) => {
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
              console.error(`[AGENT] gRPC request failed: ${err.message}, code: ${err.code}, details: ${err.details}`);
              return reject(err);
            }
            if (!resp) {
              console.error(`[AGENT] gRPC request returned no response`);
              return reject(new Error('no response'));
            }
            resolve(new Uint8Array(resp));
          }
        );
      });
    }
  };
  loggingService = new LoggingServiceClientImpl(rpc, {
    service: LoggingServiceServiceName
  });
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
  const entry: LogEntry = {
    serviceName: 'agent',
    level,
    message,
    timestamp: new Date(),
    threadId: '',
    component: '',
    fields
  };

  logToFile(level, message); // Always log to file for backup

  if (!loggingService) {
    console.error(`[AGENT] No logging service available`);
    return;
  }
  try {
    await loggingService.Log({ entry });
  } catch (error) {
    console.error(`[AGENT] Failed to send log to service:`, error);
  }
}

export function debugLog(message: string, fields: Record<string, string> = {}) {
  sendLog('DEBUG', message, fields);
}

export function infoLog(message: string, fields: Record<string, string> = {}) {
  sendLog('INFO', message, fields);
}

export function warnLog(message: string, fields: Record<string, string> = {}) {
  sendLog('WARN', message, fields);
}

export function errorLog(message: string, fields: Record<string, string> = {}) {
  sendLog('ERROR', message, fields);
}