import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { FakeChatModel } from '@langchain/core/utils/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Meal plan validation criteria from plan.md
const VALIDATION_CRITERIA = {
  maxConsecutiveHighEffort: 2,
  maxRedMeatPerWeek: 3,
} as const;

// Data structures
const MealSchema = z.object({
  id: z.number(),
  name: z.string(),
  effort: z.number(),
  hasRedMeat: z.boolean(),
});

const WeeklyMealPlanSchema = z.object({
  id: z.number().optional(),
  days: z.array(z.object({
    dayIndex: z.number(),
    meal: MealSchema
  }))
});

type WeeklyMealPlan = z.infer<typeof WeeklyMealPlanSchema>;

class MealPlannerAgent {
  private client: Client;
  private agent: any = null;

  constructor() {
    // Initialize MCP client with stdio transport
    this.client = new Client({
      name: "meal-planner-agent",
      version: "1.0.0"
    });
  }

  async initialize() {
    const isCodex = process.argv.includes("--codex");
    // Connect to MCP server via stdio
    const transport = new StdioClientTransport({
      command: "node",
      args: ["/Users/bradcarter/Documents/Dev/meal-planner/scripts/start-mcp.js", isCodex ? "--codex" : ""]
    });

    await this.client.connect(transport);

    // Discover available tools from MCP server
    const { tools: remoteTools } = await this.client.listTools();

    // Convert MCP tools to LangChain tools
    const tools = remoteTools.map((tool: any) =>
      new DynamicStructuredTool({
        name: tool.name,
        description: tool.description,
        schema: tool.inputSchema,
        func: async (args) => {
          const result = await this.client.callTool({
            name: tool.name,
            arguments: args
          });
          return JSON.stringify(result.content);
        }
      })
    );

    // Create LLM based on environment - use mock for Codex testing
    const llm = isCodex 
      ? new FakeChatModel({})
      : new ChatOpenAI({ 
          temperature: 0,
          modelName: "gpt-4o"
        });

    // Create ReACT agent
    this.agent = createReactAgent({
      llm,
      tools
    });

    console.log(`Initialized agent with ${tools.length} tools:`, tools.map(t => t.name));
  }

  // Validate meal plan against criteria
  validatePlan(plan: WeeklyMealPlan): string[] {
    const issues: string[] = [];
    
    // Check consecutive high-effort meals
    let consecutiveHighEffort = 0;
    for (const day of plan.days) {
      if (day.meal.effort > 3) {
        consecutiveHighEffort++;
        if (consecutiveHighEffort > VALIDATION_CRITERIA.maxConsecutiveHighEffort) {
          issues.push(`Too many consecutive high-effort meals (day ${day.dayIndex})`);
        }
      } else {
        consecutiveHighEffort = 0;
      }
    }

    // Check red meat count
    const redMeatCount = plan.days.filter(d => d.meal.hasRedMeat).length;
    if (redMeatCount > VALIDATION_CRITERIA.maxRedMeatPerWeek) {
      issues.push(`Too many red meat meals: ${redMeatCount} (max ${VALIDATION_CRITERIA.maxRedMeatPerWeek})`);
    }

    // Check for duplicates
    const mealIds = plan.days.map(d => d.meal.id);
    const duplicates = mealIds.filter((id, index) => mealIds.indexOf(id) !== index);
    if (duplicates.length > 0) {
      issues.push(`Duplicate meals found: ${duplicates.join(', ')}`);
    }

    return issues;
  }

  async generateOptimalMealPlan(): Promise<WeeklyMealPlan> {
    // TODO: Implement the ReACT loop from plan.md
    // 1. Generate initial plan
    // 2. Validate against criteria
    // 3. Replace problematic meals
    // 4. Repeat until satisfied
    // 5. Return final plan
    
    throw new Error("Implementation needed: generateOptimalMealPlan");
  }

  async cleanup() {
    await this.client.close();
  }
}

// Usage example
async function main() {
  const agent = new MealPlannerAgent();
  
  try {
    await agent.initialize();
    const plan = await agent.generateOptimalMealPlan();
    console.log("Generated meal plan:", JSON.stringify(plan, null, 2));
  } catch (error) {
    console.error("Agent failed:", error);
  } finally {
    await agent.cleanup();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { MealPlannerAgent, VALIDATION_CRITERIA };