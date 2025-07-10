"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleLogger = exports.LoggingClient = void 0;
exports.createLoggingClient = createLoggingClient;
exports.createConsoleLogger = createConsoleLogger;
const api_1 = require("../../../generated/ts/api");
class LoggingClient {
    client;
    serviceName;
    constructor(address, serviceName) {
        this.client = new api_1.MealPlannerAPIClientImpl(address);
        this.serviceName = serviceName;
    }
    async log(level, message, fields) {
        return this.logWithDetails(level, message, '', '', fields);
    }
    async logWithDetails(level, message, threadId, component, fields) {
        const now = Date.now();
        const entry = {
            serviceName: this.serviceName,
            level,
            message,
            timestamp: {
                seconds: Math.floor(now / 1000),
                nanos: (now % 1000) * 1000000
            },
            threadId: threadId || '',
            component: component || '',
            fields: fields || {}
        };
        const request = { entry };
        await this.client.log(request);
    }
    async debug(message, fields) {
        return this.log('DEBUG', message, fields);
    }
    async info(message, fields) {
        return this.log('INFO', message, fields);
    }
    async warn(message, fields) {
        return this.log('WARN', message, fields);
    }
    async error(message, fields) {
        return this.log('ERROR', message, fields);
    }
    async logBatch(entries) {
        const request = { entries };
        await this.client.logBatch(request);
    }
}
exports.LoggingClient = LoggingClient;
// Console-compatible logger that sends to the logging service
class ConsoleLogger {
    client;
    constructor(client) {
        this.client = client;
    }
    log(message, ...args) {
        const fullMessage = this.formatMessage(message, args);
        this.client.info(fullMessage).catch(console.error);
    }
    debug(message, ...args) {
        const fullMessage = this.formatMessage(message, args);
        this.client.debug(fullMessage).catch(console.error);
    }
    info(message, ...args) {
        const fullMessage = this.formatMessage(message, args);
        this.client.info(fullMessage).catch(console.error);
    }
    warn(message, ...args) {
        const fullMessage = this.formatMessage(message, args);
        this.client.warn(fullMessage).catch(console.error);
    }
    error(message, ...args) {
        const fullMessage = this.formatMessage(message, args);
        this.client.error(fullMessage).catch(console.error);
    }
    formatMessage(message, args) {
        if (args.length === 0)
            return message;
        try {
            return message + ' ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
        }
        catch {
            return message + ' [formatting error]';
        }
    }
}
exports.ConsoleLogger = ConsoleLogger;
// Factory function for easy setup
function createLoggingClient(address, serviceName) {
    return new LoggingClient(address, serviceName);
}
function createConsoleLogger(address, serviceName) {
    const client = createLoggingClient(address, serviceName);
    return new ConsoleLogger(client);
}
//# sourceMappingURL=logger.js.map