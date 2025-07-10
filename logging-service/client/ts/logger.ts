import { MealPlannerAPIClientImpl } from '@mealplanner/generated';
import { LogEntry, LogRequest, LogBatchRequest } from '@mealplanner/generated';

export class LoggingClient {
  private client: MealPlannerAPIClientImpl;
  private serviceName: string;

  constructor(_address: string, serviceName: string) {
    // TODO: Need to implement proper gRPC connection
    // For now, we'll need to fix this to use proper gRPC setup
    this.client = {} as MealPlannerAPIClientImpl;
    this.serviceName = serviceName;
  }

  async log(level: string, message: string, fields?: Record<string, string>): Promise<void> {
    return this.logWithDetails(level, message, '', '', fields);
  }

  async logWithDetails(
    level: string,
    message: string,
    threadId?: string,
    component?: string,
    fields?: Record<string, string>
  ): Promise<void> {
    const entry: LogEntry = {
      serviceName: this.serviceName,
      level,
      message,
      timestamp: new Date(),
      threadId: threadId || '',
      component: component || '',
      fields: fields || {}
    };

    const request: LogRequest = { entry };
    await this.client.Log(request);
  }

  async debug(message: string, fields?: Record<string, string>): Promise<void> {
    return this.log('DEBUG', message, fields);
  }

  async info(message: string, fields?: Record<string, string>): Promise<void> {
    return this.log('INFO', message, fields);
  }

  async warn(message: string, fields?: Record<string, string>): Promise<void> {
    return this.log('WARN', message, fields);
  }

  async error(message: string, fields?: Record<string, string>): Promise<void> {
    return this.log('ERROR', message, fields);
  }

  async logBatch(entries: LogEntry[]): Promise<void> {
    const request: LogBatchRequest = { entries };
    await this.client.LogBatch(request);
  }
}

// Console-compatible logger that sends to the logging service
export class ConsoleLogger {
  private client: LoggingClient;

  constructor(client: LoggingClient) {
    this.client = client;
  }

  log(message: string, ...args: any[]): void {
    const fullMessage = this.formatMessage(message, args);
    this.client.info(fullMessage).catch(console.error);
  }

  debug(message: string, ...args: any[]): void {
    const fullMessage = this.formatMessage(message, args);
    this.client.debug(fullMessage).catch(console.error);
  }

  info(message: string, ...args: any[]): void {
    const fullMessage = this.formatMessage(message, args);
    this.client.info(fullMessage).catch(console.error);
  }

  warn(message: string, ...args: any[]): void {
    const fullMessage = this.formatMessage(message, args);
    this.client.warn(fullMessage).catch(console.error);
  }

  error(message: string, ...args: any[]): void {
    const fullMessage = this.formatMessage(message, args);
    this.client.error(fullMessage).catch(console.error);
  }

  private formatMessage(message: string, args: any[]): string {
    if (args.length === 0) return message;
    
    try {
      return message + ' ' + args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
    } catch {
      return message + ' [formatting error]';
    }
  }
}

// Factory function for easy setup
export function createLoggingClient(address: string, serviceName: string): LoggingClient {
  return new LoggingClient(address, serviceName);
}

export function createConsoleLogger(address: string, serviceName: string): ConsoleLogger {
  const client = createLoggingClient(address, serviceName);
  return new ConsoleLogger(client);
}