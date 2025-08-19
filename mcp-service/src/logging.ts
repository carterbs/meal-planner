import { writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { LoggingService, LogEntry, LogRequest } from '@mealplanner/generated';
import { Timestamp } from '@bufbuild/protobuf';
let loggingClient: ReturnType<typeof createClient<typeof LoggingService>> | null = null;
let initialized = false;
let _loggingServiceAvailable = false;
export async function initLogging(_serviceName = 'mcp-server') {
    if (initialized) return;
    
    const baseUrl = process.env.LOGGING_SERVICE_ADDR || 'localhost:50052';
    
    // Retry logic for connecting to logging service
    const maxRetries = 30; // 30 attempts
    const retryDelay = 2000; // 2 seconds between attempts
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[MCP] Attempting to connect to logging service (attempt ${attempt}/${maxRetries})...`);
            console.log(`[MCP] Using baseUrl: "${baseUrl}"`);
            console.log(`[MCP] Original LOGGING_SERVICE_ADDR: "${process.env.LOGGING_SERVICE_ADDR}"`);
            console.log(`[MCP] baseUrl type: ${typeof baseUrl}, value: "${baseUrl}"`);
            
            if (!baseUrl || baseUrl === 'null' || baseUrl === 'undefined') {
                throw new Error(`Invalid baseUrl: "${baseUrl}"`);
            }
            
            // gRPC over HTTP/2 requires a protocol scheme
            const grpcUrl = baseUrl.startsWith('http://') || baseUrl.startsWith('https://') 
                ? baseUrl 
                : `http://${baseUrl}`;
            
            console.log(`[MCP] Creating gRPC transport with URL: "${grpcUrl}"`);
            
            const transport = createGrpcTransport({
                baseUrl: grpcUrl,
                httpVersion: '2',
            });
            loggingClient = createClient(LoggingService, transport);
            
            // Test connection with a basic health check
            logToFile('INFO', `Successfully connected to logging service at ${baseUrl}`);
            console.log(`[MCP] Successfully connected to logging service at ${baseUrl}`);
            initialized = true;
            _loggingServiceAvailable = true;
            sendLog('INFO', 'MCP server logging initialized');
            return;
        } catch (error) {
            console.error(`[MCP] Failed to connect to logging service (attempt ${attempt}/${maxRetries}): ${String(error)}`);
            logToFile('ERROR', `Failed to connect to logging service (attempt ${attempt}/${maxRetries}): ${String(error)}`);
            
            if (attempt === maxRetries) {
                console.error(`[MCP] Failed to connect to logging service after ${maxRetries} attempts. Continuing without logging service.`);
                loggingClient = null;
                _loggingServiceAvailable = false;
                initialized = true;
                return;
            }
            
            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
    }
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
        const err = error instanceof Error ? error : new Error(String(error));
        console.error(`[MCP] Failed to send log to service:`, err);
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

// Test-only function to reset module state
export function __resetForTesting() {
    loggingClient = null;
    initialized = false;
    _loggingServiceAvailable = false;
}
