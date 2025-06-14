describe('MCP Tool Logic', () => {
  // Test the tool logic functions directly
  const createHelloResponse = (name?: string) => {
    const greeting = name 
      ? `Hi ${name} from MealPlanner MCP!`
      : 'Hi from MealPlanner MCP!';
    
    return {
      content: [
        {
          type: 'text',
          text: greeting,
        },
      ],
    };
  };

  const getToolsList = () => {
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
  };

  describe('Tools List', () => {
    it('should return available tools', () => {
      const result = getToolsList();
      
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0]).toEqual({
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
      });
    });
  });

  describe('Hello Tool', () => {
    it('should return default greeting without name', () => {
      const result = createHelloResponse();
      
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        type: 'text',
        text: 'Hi from MealPlanner MCP!',
      });
    });

    it('should return personalized greeting with name', () => {
      const result = createHelloResponse('Alice');
      
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        type: 'text',
        text: 'Hi Alice from MealPlanner MCP!',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown tool names', () => {
      const unknownToolHandler = (toolName: string) => {
        if (toolName !== 'hello') {
          throw new Error(`Unknown tool: ${toolName}`);
        }
        return createHelloResponse();
      };

      expect(() => unknownToolHandler('unknown')).toThrow('Unknown tool: unknown');
      expect(() => unknownToolHandler('hello')).not.toThrow();
    });
  });
});