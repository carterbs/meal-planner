import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Zod schema for hello tool validation
const HelloToolArgsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Create MCP server
const server = new Server(
  {
    name: 'mealplanner-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'hello',
        description: 'A simple hello world tool',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Optional name to greet',
            },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case 'hello':
      try {
        // Validate arguments using Zod
        const validatedArgs = HelloToolArgsSchema.parse(args);
        
        const greeting = validatedArgs.name 
          ? `Hi ${validatedArgs.name} from MealPlanner MCP!`
          : 'Hi from MealPlanner MCP!';
        
        return {
          content: [
            {
              type: 'text',
              text: greeting,
            },
          ],
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new Error(`Invalid arguments: ${error.errors.map(e => e.message).join(', ')}`);
        }
        throw error;
      }
    
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// MCP SSE endpoint
app.get('/sse', async (req, res) => {
  console.error('New SSE connection');
  const transport = new SSEServerTransport('/sse', res);
  await server.connect(transport);
});

// Start HTTP server
app.listen(PORT, () => {
  console.error(`MealPlanner MCP server running on http://localhost:${PORT}`);
  console.error(`SSE endpoint available at http://localhost:${PORT}/sse`);
});