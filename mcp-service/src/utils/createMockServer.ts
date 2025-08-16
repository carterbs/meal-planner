// Test-only McpServer-like interface exported to avoid importing the SDK types in

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// tests and causing deep/complex type instantiation issues.
export type TestMcpServer = {
  tool(name: string, descriptionOrSchema: any, schemaOrHandler?: any, handler?: Function): void;
  resource?(name: string, template: any, handler: Function): void;
  prompt?(name: string, schema: any, handler: Function): void;
  connect?(transport?: any): Promise<void>;
  close?(): void;
  registeredTools?: Record<string, { name: string; description?: string; schema?: any; handler: Function }>;
  callTool(name: string, args: any): Promise<any>;
};

export function createMockServer(): McpServer & { registeredTools: Record<string, { name: string; description?: string; schema?: any; handler: Function }> } {
  const tools: Record<string, { name: string; description?: string; schema?: any; handler: Function }> = {};

  const serverLike: TestMcpServer = {
    tool(name: string, descriptionOrSchema: any, schemaOrHandler?: any, handler?: Function) {
      let description: string | undefined;
      let schema: any;
      let fn: Function | undefined;
      if (typeof schemaOrHandler === 'function') {
        schema = descriptionOrSchema;
        fn = schemaOrHandler as Function;
      } else {
        description = descriptionOrSchema;
        schema = schemaOrHandler;
        fn = handler;
      }
      tools[name] = { name, description, schema, handler: fn! };
    },
    // Use jest mock functions so tests can inspect calls (handler is often passed as the 4th arg)
    resource: (typeof jest !== 'undefined' ? jest.fn((..._args: any[]) => { return; }) : (_name: string, _template: any, _schemaOrHandler?: any, _handler?: Function) => { return; }) as any,
    prompt: (typeof jest !== 'undefined' ? jest.fn((..._args: any[]) => { return; }) : (_name: string, _schema: any, _handler: Function) => { return; }) as any,
    async connect(_transport?: any) { return; },
    close() { return; },
    registeredTools: tools,
    async callTool(name: string, args: any) {
      const entry = tools[name];
      if (!entry) throw new Error(`tool not registered: ${name}`);
      return entry.handler(args);
    }
  };

  return serverLike as unknown as McpServer & { registeredTools: Record<string, { name: string; description?: string; schema?: any; handler: Function }> };
}
