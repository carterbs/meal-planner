import { describe, it, expect, jest, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';

// Mock fs functions
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  appendFileSync: jest.fn()
}));

// Mock the generated types and clients
jest.mock('@mealplanner/generated', () => ({
  LoggingService: jest.fn(),
  LogEntry: jest.fn().mockImplementation((data) => data),
  LogRequest: jest.fn().mockImplementation((data) => data)
}));

jest.mock('@bufbuild/protobuf', () => ({
  Timestamp: {
    fromDate: jest.fn().mockReturnValue({ timestamp: 'mock' })
  }
}));

// Create mock functions that we can access from tests
const mockCreateClient = jest.fn();
const mockCreateGrpcTransport = jest.fn();

jest.mock('@connectrpc/connect', () => ({
  createClient: mockCreateClient
}));

jest.mock('@connectrpc/connect-node', () => ({
  createGrpcTransport: mockCreateGrpcTransport
}));

// Don't mock the logging module itself - let it use the mocked dependencies

const mockWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;
const mockAppendFileSync = appendFileSync as jest.MockedFunction<typeof appendFileSync>;

describe('logging', () => {
  let originalEnv: string | undefined;
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;

  beforeAll(() => {
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
  });

  afterAll(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  beforeEach(async () => {
    originalEnv = process.env.LOGGING_SERVICE_ADDR;
    console.log = jest.fn();
    console.error = jest.fn();
    jest.clearAllMocks();
    
    // Reset fs mocks
    mockWriteFileSync.mockClear();
    mockAppendFileSync.mockClear();
    
    // Reset gRPC mocks
    mockCreateClient.mockClear();
    mockCreateGrpcTransport.mockClear();
    
    // Mock setTimeout globally to avoid real delays
    jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
      setImmediate(cb);
      return {} as any;
    });
    
    // Reset logging module state
    const { __resetForTesting } = await import('./logging.js');
    __resetForTesting();
  });

  afterEach(() => {
    process.env.LOGGING_SERVICE_ADDR = originalEnv;
    jest.restoreAllMocks();
  });

  describe('initLogging', () => {
    it('should use default baseUrl when LOGGING_SERVICE_ADDR not set', async () => {
      delete process.env.LOGGING_SERVICE_ADDR;
      
      const mockTransport = { mock: 'transport' };
      const mockClient = { log: jest.fn().mockResolvedValue({}) };
      
      mockCreateGrpcTransport.mockReturnValue(mockTransport);
      mockCreateClient.mockReturnValue(mockClient);
      
      const { initLogging } = await import('./logging.js');
      await initLogging();

      expect(mockCreateGrpcTransport).toHaveBeenCalledWith({
        baseUrl: 'http://localhost:50052',
        httpVersion: '2'
      });
    });

    it('should use custom LOGGING_SERVICE_ADDR when set', async () => {
      process.env.LOGGING_SERVICE_ADDR = 'custom-host:50053';
      
      const mockTransport = { mock: 'transport' };
      const mockClient = { log: jest.fn().mockResolvedValue({}) };
      
      mockCreateGrpcTransport.mockReturnValue(mockTransport);
      mockCreateClient.mockReturnValue(mockClient);
      
      const { initLogging } = await import('./logging.js');
      await initLogging();

      expect(mockCreateGrpcTransport).toHaveBeenCalledWith({
        baseUrl: 'http://custom-host:50053',
        httpVersion: '2'
      });
    });

    it('should handle baseUrl with http protocol', async () => {
      process.env.LOGGING_SERVICE_ADDR = 'http://custom-host:50053';
      
      const mockTransport = { mock: 'transport' };
      const mockClient = { log: jest.fn().mockResolvedValue({}) };
      
      mockCreateGrpcTransport.mockReturnValue(mockTransport);
      mockCreateClient.mockReturnValue(mockClient);
      
      const { initLogging } = await import('./logging.js');
      await initLogging();

      expect(mockCreateGrpcTransport).toHaveBeenCalledWith({
        baseUrl: 'http://custom-host:50053',
        httpVersion: '2'
      });
    });

    it('should retry connection on failure and eventually succeed', async () => {
      // Set a proper baseUrl for this test
      process.env.LOGGING_SERVICE_ADDR = 'localhost:50052';
      
      const mockTransport = { mock: 'transport' };
      const mockClient = { log: jest.fn().mockResolvedValue({}) };
      
      mockCreateGrpcTransport
        .mockImplementationOnce(() => { throw new Error('Connection failed'); })
        .mockImplementationOnce(() => { throw new Error('Connection failed'); })
        .mockReturnValue(mockTransport);
      mockCreateClient.mockReturnValue(mockClient);
      
      const { initLogging } = await import('./logging.js');
      await initLogging();

      expect(mockCreateGrpcTransport).toHaveBeenCalledTimes(3);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[MCP] Failed to connect to logging service (attempt 1/30)')
      );
    });

    it('should handle invalid baseUrl', async () => {
      process.env.LOGGING_SERVICE_ADDR = 'null';
      
      const { initLogging } = await import('./logging.js');
      await initLogging();

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid baseUrl: "null"')
      );
    });

    it('should not reinitialize if already initialized', async () => {
      // Set a proper baseUrl for this test
      process.env.LOGGING_SERVICE_ADDR = 'localhost:50052';
      
      const mockTransport = { mock: 'transport' };
      const mockClient = { log: jest.fn().mockResolvedValue({}) };
      
      mockCreateGrpcTransport.mockReturnValue(mockTransport);
      mockCreateClient.mockReturnValue(mockClient);
      
      const { initLogging } = await import('./logging.js');
      await initLogging();
      await initLogging(); // Second call

      expect(mockCreateGrpcTransport).toHaveBeenCalledTimes(1);
    });
  });

  describe('file logging', () => {
    it('should append to log file when file exists', async () => {
      // Set up environment and mocks for this test
      process.env.LOGGING_SERVICE_ADDR = 'localhost:50052';
      mockAppendFileSync.mockImplementation(() => {});
      
      const mockTransport = { mock: 'transport' };
      const mockClient = { log: jest.fn().mockResolvedValue({}) };
      mockCreateGrpcTransport.mockReturnValue(mockTransport);
      mockCreateClient.mockReturnValue(mockClient);
      
      const { infoLog } = await import('./logging.js');
      await infoLog('Test message');

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        join(process.cwd(), 'mcp-debug.log'),
        expect.stringContaining('[INFO] Test message')
      );
    });

    it('should create new log file when append fails', async () => {
      // Set up environment and mocks for this test
      process.env.LOGGING_SERVICE_ADDR = 'localhost:50052';
      mockAppendFileSync.mockImplementation(() => { throw new Error('File not found'); });
      mockWriteFileSync.mockImplementation(() => {});
      
      const mockTransport = { mock: 'transport' };
      const mockClient = { log: jest.fn().mockResolvedValue({}) };
      mockCreateGrpcTransport.mockReturnValue(mockTransport);
      mockCreateClient.mockReturnValue(mockClient);
      
      const { infoLog } = await import('./logging.js');
      await infoLog('Test message');

      expect(mockAppendFileSync).toHaveBeenCalled();
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        join(process.cwd(), 'mcp-debug.log'),
        expect.stringContaining('[INFO] Test message')
      );
    });

    it('should handle both append and write failures gracefully', async () => {
      // Set up environment and mocks for this test
      process.env.LOGGING_SERVICE_ADDR = 'localhost:50052';
      mockAppendFileSync.mockImplementation(() => { throw new Error('Append failed'); });
      mockWriteFileSync.mockImplementation(() => { throw new Error('Write failed'); });
      
      const mockTransport = { mock: 'transport' };
      const mockClient = { log: jest.fn().mockResolvedValue({}) };
      mockCreateGrpcTransport.mockReturnValue(mockTransport);
      mockCreateClient.mockReturnValue(mockClient);
      
      const { infoLog } = await import('./logging.js');
      
      // Should not throw
      await expect(infoLog('Test message')).resolves.toBeUndefined();
    });
  });

  describe('log level functions', () => {
    beforeEach(async () => {
      // Set up proper environment for gRPC tests
      process.env.LOGGING_SERVICE_ADDR = 'localhost:50052';
      
      const mockTransport = { mock: 'transport' };
      const mockClient = { log: jest.fn().mockResolvedValue({}) };
      
      mockCreateGrpcTransport.mockReturnValue(mockTransport);
      mockCreateClient.mockReturnValue(mockClient);
    });

    it('should call debugLog with correct level', async () => {
      mockAppendFileSync.mockImplementation(() => {});
      
      const { debugLog } = await import('./logging.js');
      await debugLog('Debug message', { key: 'value' });

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('[DEBUG] Debug message')
      );
    });

    it('should call infoLog with correct level', async () => {
      mockAppendFileSync.mockImplementation(() => {});
      
      const { infoLog } = await import('./logging.js');
      await infoLog('Info message', { key: 'value' });

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('[INFO] Info message')
      );
    });

    it('should call warnLog with correct level', async () => {
      mockAppendFileSync.mockImplementation(() => {});
      
      const { warnLog } = await import('./logging.js');
      await warnLog('Warn message', { key: 'value' });

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('[WARN] Warn message')
      );
    });

    it('should call errorLog with correct level', async () => {
      mockAppendFileSync.mockImplementation(() => {});
      
      const { errorLog } = await import('./logging.js');
      await errorLog('Error message', { key: 'value' });

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('[ERROR] Error message')
      );
    });

    it('should handle gRPC client errors gracefully', async () => {
      // Set a proper baseUrl for this test
      process.env.LOGGING_SERVICE_ADDR = 'localhost:50052';
      
      const mockTransport = { mock: 'transport' };
      const mockClient = { log: jest.fn().mockRejectedValue(new Error('gRPC error')) };
      
      mockCreateGrpcTransport.mockReturnValue(mockTransport);
      mockCreateClient.mockReturnValue(mockClient);
      
      const { infoLog } = await import('./logging.js');
      await infoLog('Test message');

      expect(console.error).toHaveBeenCalledWith(
        '[MCP] Failed to send log to service:',
        expect.any(Error)
      );
    });

    it('should handle missing gRPC client gracefully', async () => {
      // Set up proper environment but force connection failure
      process.env.LOGGING_SERVICE_ADDR = 'localhost:50052';
      mockAppendFileSync.mockImplementation(() => {});
      
      // Force max retries to be reached
      mockCreateGrpcTransport.mockImplementation(() => {
        throw new Error('Connection failed');
      });
      
      const { infoLog } = await import('./logging.js');
      await infoLog('Test message');

      expect(console.error).toHaveBeenCalledWith('[MCP] No logging client available');
    });
  });
});