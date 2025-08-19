// Test-only McpServer-like interface exported to avoid importing the SDK types in

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// tests and causing deep/complex type instantiation issues.
export type TestMcpServer = {
  tool(name: string, descriptionOrSchema: unknown, schemaOrHandler?: unknown, handler?: (...args: unknown[]) => unknown): void;
  resource?(name: string, template: unknown, handler: (...args: unknown[]) => unknown): void;
  prompt?(name: string, schema: unknown, handler: (...args: unknown[]) => unknown): void;
  connect?(transport?: unknown): Promise<void>;
  close?(): void;
  registeredTools?: Record<string, { name: string; description?: string; schema?: unknown; handler: (...args: unknown[]) => unknown }>;
  callTool(name: string, args: unknown): Promise<unknown>;
};

export function createMockServer(): McpServer & { registeredTools: Record<string, { name: string; description?: string; schema?: unknown; handler: (...args: unknown[]) => unknown }> } {
  const tools: Record<string, { name: string; description?: string; schema?: unknown; handler: (...args: unknown[]) => unknown }> = {};

  const serverLike: TestMcpServer = {
    tool(name: string, descriptionOrSchema: unknown, schemaOrHandler?: unknown, handler?: (...args: unknown[]) => unknown) {
      let description: string | undefined;
      let schema: unknown;
      let fn: ((...args: unknown[]) => unknown) | undefined;
      if (typeof schemaOrHandler === 'function') {
        schema = descriptionOrSchema;
        fn = schemaOrHandler as (...args: unknown[]) => unknown;
      } else {
        description = descriptionOrSchema as string;
        schema = schemaOrHandler;
        fn = handler;
      }
      if (fn) {
        tools[name] = { name, description, schema, handler: fn };
      }
    },
    // Use jest mock functions so tests can inspect calls (handler is often passed as the 4th arg)
    resource: (typeof jest !== 'undefined' ? jest.fn((..._args: unknown[]) => undefined) : (_name: string, _template: unknown, _schemaOrHandler?: unknown, _handler?: (...args: unknown[]) => unknown) => undefined) as unknown as (...args: unknown[]) => unknown,
    prompt: (typeof jest !== 'undefined' ? jest.fn((..._args: unknown[]) => undefined) : (_name: string, _schema: unknown, _handler: (...args: unknown[]) => unknown) => undefined) as unknown as (...args: unknown[]) => unknown,
    async connect(_transport?: unknown) { return; },
    close() { return; },
    registeredTools: tools,
    async callTool(name: string, args: unknown) {
      if (!(name in tools)) throw new Error(`tool not registered: ${name}`);
      const entry = tools[name];
      return entry.handler(args);
    }
  };

  return serverLike as unknown as McpServer & { registeredTools: Record<string, { name: string; description?: string; schema?: unknown; handler: (...args: unknown[]) => unknown }> };
}
