import { writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { LoggingService, LogEntry, LogRequest } from '@mealplanner/generated';
import { Timestamp } from '@bufbuild/protobuf';
let loggingClient: ReturnType<typeof createClient<typeof LoggingService>> | null = null;
let initialized = false;
let loggingServiceAvailable = false;
export async function initLogging(_serviceName = 'mcp-server') {
    if (initialized)
        return;
    const baseUrl = process.env.LOGGING_SERVICE_ADDR || 'http://localhost:50052';
    try {
        const transport = createGrpcTransport({
            baseUrl,
            httpVersion: '2',
        });
        loggingClient = createClient(LoggingService, transport);
        // Test connection with a basic health check
        await loggingClient.log(new LogRequest({
            entry: new LogEntry({
                serviceName: 'mcp-server',
                level: 'INFO',
                message: 'Testing logging service connection',
                timestamp: Timestamp.fromDate(new Date()),
                threadId: '',
                component: '',
                fields: {}
            })
        }));
        loggingServiceAvailable = true;
        logToFile('INFO', `Successfully connected to logging service at ${baseUrl}`);
    }
    catch (error) {
        console.error(`[MCP] Logging service not available at ${baseUrl}, falling back to file-only logging`);
        logToFile('WARN', `Logging service not available: ${error}. Using file-only logging.`);
        loggingClient = null;
        loggingServiceAvailable = false;
    }
    initialized = true;
    sendLog('INFO', 'MCP server logging initialized');
}
function logToFile(level: string, message: string) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;
    const debugLogPath = join(process.cwd(), 'mcp-debug.log');
    try {
        appendFileSync(debugLogPath, logEntry);
    }
    catch {
        try {
            writeFileSync(debugLogPath, logEntry);
        }
        catch { /* ignore */ }
    }
}
async function sendLog(level: string, message: string, fields: Record<string, string> = {}) {
    await initLogging();
    const entry = new LogEntry({
        serviceName: 'mcp-server',
        level,
        message,
        timestamp: Timestamp.fromDate(new Date()),
        threadId: '',
        component: '',
        fields
    });
    logToFile(level, message); // Always log to file for backup
    if (!loggingClient) {
        console.error(`[MCP] No logging client available`);
        return;
    }
    try {
        await loggingClient.log(new LogRequest({ entry }));
    }
    catch (error) {
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
