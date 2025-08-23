import { describe, it, expect, jest, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import type * as express from 'express';

// Type definitions for mocks  
interface MockExpressApp {
  use: jest.Mock;
  all: jest.Mock;
  get: jest.Mock;
  listen: jest.Mock;
}

interface MockMcpServer {
  connect: jest.Mock;
}

interface MockTransport {
  handleRequest: jest.Mock;
}

type MockedRegistrationFunction = jest.Mock;

// Mock all the dependencies first
jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    tool: jest.fn(),
    resource: jest.fn()
  }))
}));

jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  __esModule: true,
  StreamableHTTPServerTransport: jest.fn().mockImplementation(() => ({
    handleRequest: jest.fn()
  }))
}));

jest.mock('./logging.js', () => ({
  initLogging: jest.fn(),
  infoLog: jest.fn(),
  errorLog: jest.fn()
}));

// Mock all resource registrations
jest.mock('./resources/weeklyMealPlan.js', () => ({
  registerWeeklyMealPlan: jest.fn()
}));

jest.mock('./resources/recipes.js', () => ({
  registerRecipes: jest.fn()
}));

jest.mock('./resources/recipeSteps.js', () => ({
  registerRecipeSteps: jest.fn()
}));

// Mock all tool registrations
jest.mock('./tools/generateMealPlan.js', () => ({
  registerGenerateMealPlan: jest.fn()
}));

jest.mock('./tools/finalizeMealPlan.js', () => ({
  registerFinalizeMealPlan: jest.fn()
}));

jest.mock('./tools/swapMeal.js', () => ({
  registerSwapMeal: jest.fn()
}));

jest.mock('./tools/replaceMeal.js', () => ({
  registerReplaceMeal: jest.fn()
}));

jest.mock('./tools/generateShoppingList.js', () => ({
  registerGenerateShoppingList: jest.fn()
}));

jest.mock('./tools/createRecipe.js', () => ({
  registerCreateRecipe: jest.fn()
}));

jest.mock('./tools/deleteRecipe.js', () => ({
  registerDeleteRecipe: jest.fn()
}));

jest.mock('./tools/getMeals.js', () => ({
  registerGetMeals: jest.fn()
}));

jest.mock('./tools/getCurrentMealPlan.js', () => ({
  registerGetCurrentMealPlan: jest.fn()
}));

jest.mock('./tools/removeMeal.js', () => ({
  registerRemoveMeal: jest.fn()
}));

// Create shared mock instances at module level
const sharedMockApp: MockExpressApp = {
  use: jest.fn(),
  all: jest.fn(),
  get: jest.fn(),
  listen: jest.fn().mockImplementation((...args: unknown[]) => {
    const callback = args.find((arg): arg is () => void => typeof arg === 'function');
    if (callback) callback();
    return { close: jest.fn() };
  })
};

jest.mock('express', () => {
  const expressMock = jest.fn().mockReturnValue(sharedMockApp);
  Object.assign(expressMock, {
    json: jest.fn(() => (req: express.Request, res: express.Response, next: express.NextFunction) => next())
  });
  return { __esModule: true, default: expressMock };
});

jest.mock('cors', () => ({
  __esModule: true,
  default: jest.fn(() => (req: express.Request, res: express.Response, next: express.NextFunction) => next())
}));

describe('index (main application)', () => {
  let originalEnv: string | undefined;
  let originalConsoleError: typeof console.error;
  let originalProcessExit: typeof process.exit;

  beforeAll(() => {
    originalConsoleError = console.error;
    originalProcessExit = process.exit;
  });

  afterAll(() => {
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });

  beforeEach(() => {
    originalEnv = process.env.MCP_PORT;
    console.error = jest.fn();
    process.exit = jest.fn() as jest.MockedFunction<typeof process.exit>;
    jest.resetModules();
    // Clear the shared mock app calls before each test
    sharedMockApp.use.mockClear();
    sharedMockApp.all.mockClear();
    sharedMockApp.get.mockClear();
    sharedMockApp.listen.mockClear();
  });

  afterEach(() => {
    process.env.MCP_PORT = originalEnv;
    jest.restoreAllMocks();
  });

  describe('server initialization', () => {
    it('should create MCP server with correct name and version', async () => {
      const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
      
      // Import the module to trigger initialization
      await import('./index.js');
      await new Promise(resolve => setTimeout(resolve, 50)); // Wait for async main

      expect(McpServer).toHaveBeenCalledWith({
        name: 'mealplanner-mcp',
        version: '1.0.0'
      });
    });

    it('should register all resources', async () => {
      const { registerWeeklyMealPlan } = await import('./resources/weeklyMealPlan.js');
      const { registerRecipes } = await import('./resources/recipes.js');
      const { registerRecipeSteps } = await import('./resources/recipeSteps.js');

      // Import the module to trigger registration
      await import('./index.js');
      await new Promise(resolve => setTimeout(resolve, 50)); // Wait for async main

      expect(registerWeeklyMealPlan).toHaveBeenCalled();
      expect(registerRecipes).toHaveBeenCalled();
      expect(registerRecipeSteps).toHaveBeenCalled();
    });

    it('should register all tools', async () => {
      const tools = [
        './tools/generateMealPlan.js',
        './tools/finalizeMealPlan.js',
        './tools/swapMeal.js',
        './tools/replaceMeal.js',
        './tools/generateShoppingList.js',
        './tools/createRecipe.js',
        './tools/deleteRecipe.js',
        './tools/getMeals.js',
        './tools/getCurrentMealPlan.js',
        './tools/removeMeal.js'
      ];

      const registrationFunctions: MockedRegistrationFunction[] = [];
      for (const tool of tools) {
        const module = await import(tool) as Record<string, unknown>;
        const moduleValues = Object.values(module);
        const firstExport = moduleValues[0] as MockedRegistrationFunction;
        registrationFunctions.push(firstExport);
      }

      // Import the module to trigger registration
      await import('./index.js');
      await new Promise(resolve => setTimeout(resolve, 50)); // Wait for async main

      registrationFunctions.forEach((fn) => {
        expect(fn).toHaveBeenCalled();
      });
    });
  });

  describe('main function', () => {
    it('should use default port when MCP_PORT not set', async () => {
      delete process.env.MCP_PORT;
      
      // Import and wait for main to complete
      await import('./index.js');
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(sharedMockApp.listen).toHaveBeenCalledWith(3001, expect.any(Function));
    });

    it('should use custom port when MCP_PORT is set', async () => {
      process.env.MCP_PORT = '4000';

      // Import and wait for main to complete
      await import('./index.js');
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(sharedMockApp.listen).toHaveBeenCalledWith(4000, expect.any(Function));
    });

    it('should initialize logging', async () => {
      const { initLogging } = await import('./logging.js');

      await import('./index.js');
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(initLogging).toHaveBeenCalledWith('mcp-server');
    });

    it('should handle logging initialization errors', async () => {
      const { initLogging, errorLog } = await import('./logging.js');
      const mockError = new Error('Logging init failed');
      
      (initLogging as jest.MockedFunction<typeof initLogging>).mockRejectedValueOnce(mockError);

      await import('./index.js');
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(errorLog).toHaveBeenCalledWith('Failed to initialize logging: ' + String(mockError));
    });

    it('should setup Express middleware', async () => {
      const cors = (await import('cors')).default;

      await import('./index.js');
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(cors).toHaveBeenCalledWith({
        origin: true,
        credentials: true
      });

      const express = (await import('express')).default;
      const mockApp = (express as unknown as jest.Mock).mock.results[0].value as MockExpressApp;
      expect(mockApp.use).toHaveBeenCalledTimes(2); // Should be called twice
      expect(mockApp.use).toHaveBeenNthCalledWith(1, expect.any(Function)); // cors()
      expect(mockApp.use).toHaveBeenNthCalledWith(2, expect.any(Function)); // express.json()
    });

    it('should setup MCP transport and connect server', async () => {
      await import('./index.js');
      await new Promise(resolve => setTimeout(resolve, 50));

      const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
      const serverInstance = (McpServer as jest.Mock).mock.results[0]?.value as MockMcpServer;
      expect(serverInstance.connect).toHaveBeenCalled();
    });

    it('should handle fatal errors and exit', async () => {
      const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
      const mockError = new Error('Fatal error');
      
      // Make McpServer constructor throw an unhandled error (outside try-catch)
      (McpServer as jest.Mock).mockImplementationOnce(() => {
        throw mockError;
      });
      
      await import('./index.js');
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(console.error).toHaveBeenCalledWith('Fatal error in MCP server:', {
        message: mockError.message,
        stack: mockError.stack,
        name: mockError.name
      });
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('Express routes', () => {
    it('should setup /mcp route handler', async () => {
      await import('./index.js');
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(sharedMockApp.all).toHaveBeenCalledWith('/mcp', expect.any(Function));
    });

    it('should setup /health route handler', async () => {
      await import('./index.js');
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(sharedMockApp.get).toHaveBeenCalledWith('/health', expect.any(Function));
    });

    it('should handle MCP requests successfully', async () => {
      const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
      
      const mockHandleRequest = jest.fn(() => Promise.resolve());
      const mockTransport: MockTransport = { handleRequest: mockHandleRequest };
      (StreamableHTTPServerTransport as jest.Mock).mockReturnValue(mockTransport);
      
      await import('./index.js');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Get the /mcp handler
      const mcpHandler = (sharedMockApp.all).mock.calls
        .find((call: unknown[]) => call[0] === '/mcp')![1] as (req: express.Request, res: express.Response) => Promise<void>;

      const mockReq = { body: { test: 'data' } } as unknown as express.Request;
      const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as express.Response;

      await mcpHandler(mockReq, mockRes);

      expect(mockTransport.handleRequest).toHaveBeenCalledWith(mockReq, mockRes, mockReq.body);
    });

    it('should handle MCP request errors', async () => {
      const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
      const { errorLog } = await import('./logging.js');
      
      const mockError = new Error('Transport error');
      const mockHandleRequest = jest.fn(() => Promise.reject(mockError));
      const mockTransport: MockTransport = { handleRequest: mockHandleRequest };
      (StreamableHTTPServerTransport as jest.Mock).mockReturnValue(mockTransport);
      
      await import('./index.js');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Get the /mcp handler
      const mcpHandler = (sharedMockApp.all).mock.calls
        .find((call: unknown[]) => call[0] === '/mcp')![1] as (req: express.Request, res: express.Response) => Promise<void>;

      const mockReq = { body: { test: 'data' } } as unknown as express.Request;
      const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as express.Response;

      await mcpHandler(mockReq, mockRes);

      expect(errorLog).toHaveBeenCalledWith(`Error handling MCP request: ${String(mockError)}`);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('should handle health check with healthy logging', async () => {
      const { infoLog } = await import('./logging.js');
      
      (infoLog as jest.MockedFunction<typeof infoLog>).mockResolvedValue(undefined);
      
      await import('./index.js');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Get the /health handler
      const healthHandler = (sharedMockApp.get).mock.calls
        .find((call: unknown[]) => call[0] === '/health')![1] as (req: express.Request, res: express.Response) => Promise<void>;

      const mockReq = {} as unknown as express.Request;
      const mockRes = { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as express.Response;

      await healthHandler(mockReq, mockRes);

      expect(infoLog).toHaveBeenCalledWith('Health check test message');
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'ok',
        service: 'mealplanner-mcp',
        message: 'All dependencies healthy'
      });
    });

    it('should handle health check with unhealthy logging', async () => {
      const { infoLog } = await import('./logging.js');
      
      const mockError = new Error('Logging service down');
      (infoLog as jest.MockedFunction<typeof infoLog>).mockRejectedValue(mockError);
      
      await import('./index.js');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Get the /health handler
      const healthHandler = (sharedMockApp.get).mock.calls
        .find((call: unknown[]) => call[0] === '/health')![1] as (req: express.Request, res: express.Response) => Promise<void>;

      const mockReq = {} as unknown as express.Request;
      const mockRes = { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as express.Response;

      await healthHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        service: 'mealplanner-mcp',
        message: `Health check failed: Logging service connection failed: ${String(mockError)}`
      });
    });
  });
});
