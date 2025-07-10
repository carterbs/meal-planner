import { ChannelCredentials, Metadata, Client, credentials } from '@grpc/grpc-js';
import { MealPlannerAPIClientImpl } from '@mealplanner/generated';
import { LogEntry, LogRequest, LogBatchRequest } from '@mealplanner/generated';

// Define the RPC options interface
interface RpcOptions {
  request(service: string, method: string, data: Uint8Array): Promise<Uint8Array>;
}

export class LoggingClient {
  private client: MealPlannerAPIClientImpl;
  private serviceName: string;
  private metadata: Metadata;
  private isConnected: boolean = false;
  private channelCredentials: ChannelCredentials;
  private serverAddress: string;

  constructor(address: string, serviceName: string) {
    this.serviceName = serviceName;
    this.serverAddress = address;
    
    // Create insecure credentials (use createSsl() for production with TLS)
    this.channelCredentials = ChannelCredentials.createInsecure();
    
    // Create metadata for the service name
    this.metadata = new Metadata();
    this.metadata.add('service-name', serviceName);
    
    // Create a new client instance with the provided address and credentials
    // Create a custom RPC implementation that wraps the gRPC client
    const rpcImpl: RpcOptions = {
      // Implement the request method to handle unary calls
      request: (service: string, method: string, data: Uint8Array): Promise<Uint8Array> => {
        return new Promise((resolve, reject) => {
          const grpcClient = new Client(
            this.serverAddress,
            this.channelCredentials,
            {
              'grpc.max_receive_message_length': -1, // Unlimited
              'grpc.max_send_message_length': -1,    // Unlimited
            }
          );
          
          // Make the gRPC call
          const call = grpcClient.makeUnaryRequest(
            `/${service}/${method}`,
            (arg: Uint8Array) => Buffer.from(arg),
            (data: Buffer) => data,
            Buffer.from(data),
            (error: Error | null, response: Buffer | undefined) => {
              grpcClient.close();
              if (error) {
                reject(error);
              } else if (!response) {
                reject(new Error('No response received from server'));
              } else {
                resolve(new Uint8Array(response));
              }
            }
          );
        });
      }
    };
    
    // Create the client with our custom RPC implementation
    this.client = new MealPlannerAPIClientImpl(rpcImpl);
    
    // Set up connection state tracking
    this.setupConnectionState();
  }
  
  private setupConnectionState() {
    // Create a temporary client just for connection checking
    const checkClient = new Client(
      this.serverAddress,
      this.channelCredentials,
      {
        'grpc.max_receive_message_length': -1,
        'grpc.max_send_message_length': -1,
      }
    );
    
    // Set up a connection state listener
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + 5);
    
    checkClient.waitForReady(deadline, (error?: Error) => {
      if (error) {
        console.error('Failed to connect to logging service:', error);
        this.isConnected = false;
      } else {
        console.log('Successfully connected to logging service');
        this.isConnected = true;
        
        // Set up a connection state change listener
        try {
          const channel = checkClient.getChannel();
          const currentState = channel.getConnectivityState(false);
          this.isConnected = currentState === 2; // 2 is READY state
          
          channel.watchConnectivityState(
            currentState,
            Date.now() + 3600000, // Check again in 1 hour
            (error) => {
              if (error) {
                console.error('Error watching connectivity state:', error);
                this.isConnected = false;
              } else {
                const newState = channel.getConnectivityState(false);
                this.isConnected = newState === 2; // 2 is READY state
                console.log('Connection state changed:', newState, 'Connected:', this.isConnected);
              }
            }
          );
        } catch (error) {
          console.error('Error setting up connection state monitoring:', error);
        }
      }
      
      // Close the temporary client
      checkClient.close();
    });
  }
  
  private logToConsole(level: string, message: string, threadId: string, component: string, fields: Record<string, string>) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      level,
      message,
      threadId,
      component,
      ...fields
    };
    
    const logString = JSON.stringify(logEntry, null, 2);
    
    switch (level) {
      case 'ERROR':
        console.error(logString);
        break;
      case 'WARN':
        console.warn(logString);
        break;
      case 'INFO':
      case 'DEBUG':
      default:
        console.log(logString);
        break;
    }
  }

  async log(level: string, message: string, fields: Record<string, string> = {}): Promise<void> {
    return this.logWithDetails(level, message, '', '', fields);
  }

  async logWithDetails(
    level: string,
    message: string,
    threadId: string = '',
    component: string = '',
    fields: Record<string, string> = {}
  ): Promise<void> {
    const entry: LogEntry = {
      serviceName: this.serviceName,
      level,
      message,
      timestamp: new Date(),
      threadId,
      component,
      fields: { ...fields }
    };

    const request: LogRequest = { entry };
    
    // Always log to console for local development
    this.logToConsole(level, message, threadId, component, fields);
    
    // If not connected, resolve without sending to server
    if (!this.isConnected) {
      return Promise.resolve();
    }
    
    return new Promise<void>((resolve, reject) => {
      try {
        // Call the generated client method with the request
        this.client.Log(request)
          .then(() => resolve())
          .catch((error: Error) => {
            console.error('Failed to send log to server:', error);
            reject(error);
          });
      } catch (error) {
        console.error('Error in Log RPC call:', error);
        reject(error);
      }
    });
  }

  async debug(message: string, fields: Record<string, string> = {}): Promise<void> {
    return this.log('DEBUG', message, fields);
  }

  async info(message: string, fields: Record<string, string> = {}): Promise<void> {
    return this.log('INFO', message, fields);
  }

  async warn(message: string, fields: Record<string, string> = {}): Promise<void> {
    return this.log('WARN', message, fields);
  }

  async error(message: string, fields: Record<string, string> = {}): Promise<void> {
    return this.log('ERROR', message, fields);
  }

  /**
   * Logs multiple entries in a single batch request
   * @param entries Array of log entries to send
   */
  async logBatch(entries: Array<{
    level: string;
    message: string;
    threadId?: string;
    component?: string;
    fields?: Record<string, string>;
  }>): Promise<void> {
    // Always log each entry to console for local development
    entries.forEach(entry => {
      this.logToConsole(
        entry.level,
        entry.message,
        entry.threadId || '',
        entry.component || '',
        entry.fields || {}
      );
    });

    // If not connected, resolve without sending to server
    if (!this.isConnected) {
      return Promise.resolve();
    }

    const logEntries: LogEntry[] = entries.map(entry => ({
      serviceName: this.serviceName,
      level: entry.level,
      message: entry.message,
      timestamp: new Date(),
      threadId: entry.threadId || '',
      component: entry.component || '',
      fields: entry.fields || {}
    }));

    const request: LogBatchRequest = { entries: logEntries };
    
    return new Promise<void>((resolve, reject) => {
      try {
        // Call the generated client method with the request
        this.client.LogBatch(request)
          .then(() => resolve())
          .catch((error: Error) => {
            console.error('Failed to send batch logs to server:', error);
            reject(error);
          });
      } catch (error) {
        console.error('Error in LogBatch RPC call:', error);
        reject(error);
      }
    });
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