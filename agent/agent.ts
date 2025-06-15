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
  mealName: z.string(),
  relativeEffort: z.number(),
  redMeat: z.boolean(),
});

// MCP tool result types
interface MCPTextContent {
  type: 'text';
  text: string;
}

interface MCPToolResult {
  content: MCPTextContent[];
  isError?: boolean;
}

// Backend format from /api/mealplan/generate
const BackendMealPlanSchema = z.record(z.string(), z.object({
  Breakfast: MealSchema.nullable(),
  Lunch: MealSchema.nullable(), 
  Dinner: MealSchema.nullable()
}));

// Internal schema used by agent
const InternalMealSchema = z.object({
  id: z.number(),
  name: z.string(),
  effort: z.number(),
  hasRedMeat: z.boolean(),
});

const WeeklyMealPlanSchema = z.object({
  id: z.number().optional(),
  days: z.array(z.object({
    dayIndex: z.number(),
    mealType: z.string(),
    meal: InternalMealSchema
  }))
});

type WeeklyMealPlan = z.infer<typeof WeeklyMealPlanSchema>;

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

class MealPlannerAgent {
  private client: Client;
  private agent: any = null;

  constructor(client?: Client) {
    // Allow injecting a custom MCP client for testing
    this.client = client ?? new Client({
      name: "meal-planner-agent",
      version: "1.0.0",
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
          modelName: "gpt-4.1-mini"
        });

    // Create ReACT agent
    this.agent = createReactAgent({
      llm,
      tools
    });

    console.log(`🤖 [AGENT] Initialized agent with ${tools.length} tools:`, tools.map(t => t.name));
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

  // Transform backend format to internal format
  private transformBackendPlan(backendPlan: any): WeeklyMealPlan {
    const days = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner'] as const;
    
    for (let i = 0; i < dayNames.length; i++) {
      const dayName = dayNames[i];
      const dayData = backendPlan[dayName];
      
      if (dayData) {
        for (const mealType of mealTypes) {
          const meal = dayData[mealType];
          if (meal && meal.id) {
            days.push({
              dayIndex: i,
              mealType: mealType.toLowerCase(),
              meal: {
                id: meal.id,
                name: meal.mealName,
                effort: meal.relativeEffort,
                hasRedMeat: meal.redMeat
              }
            });
          }
        }
      }
    }
    
    return { days };
  }

  async generateOptimalMealPlan(): Promise<WeeklyMealPlan> {
    // Generate an initial meal plan using the MCP tool
    const planResult = await this.client.callTool({
      name: 'generateMealPlan',
      arguments: {}
    });

    const backendPlan = BackendMealPlanSchema.parse(
      JSON.parse((planResult as MCPToolResult).content[0].text)
    );

    let plan = this.transformBackendPlan(backendPlan);

    // Use LLM to optimize the meal plan
    let issues = this.validatePlan(plan);
    if (issues.length > 0) {
      console.log("📋 [LOG] Initial validation issues:", issues);
      
      const optimizedPlan = await this.optimizePlanWithLLM(plan, issues);
      plan = optimizedPlan;
      
      const finalIssues = this.validatePlan(plan);
      if (finalIssues.length > 0) {
        console.log("📋 [LOG] Remaining validation issues after LLM optimization:", finalIssues);
        console.log("🤖 [AGENT DECISION] Trying once more");
        plan = await this.optimizePlanWithLLM(plan, finalIssues);
      } else {
        console.log("✅ [AGENT SUCCESS] Plan successfully optimized by LLM!");
      }
    }

    return plan;
  }

  private async optimizePlanWithLLM(plan: WeeklyMealPlan, issues: string[]): Promise<WeeklyMealPlan> {
    // Fetch available meals
    const mealsResp = await this.client.callTool({
      name: 'getMeals',
      arguments: {}
    });
    const availableMeals: any[] = JSON.parse((mealsResp as MCPToolResult).content[0].text);

    // Create concise meal options for the prompt
    const mealOptions = availableMeals.map(m => 
      `${m.id}: ${m.mealName} (${m.mealType}, effort: ${m.relativeEffort}, red meat: ${m.redMeat})`
    ).join('\n');

    const planDescription = plan.days.map(day => 
      `${DAY_NAMES[day.dayIndex]} ${day.mealType}: ${day.meal.name} (ID: ${day.meal.id}, effort: ${day.meal.effort}, red meat: ${day.meal.hasRedMeat})`
    ).join('\n');

    const prompt = `You are optimizing a weekly meal plan. Here are the current issues:
${issues.join('\n')}

Current meal plan:
${planDescription}

Available meals to choose from:
${mealOptions}

Optimization rules:
- Max ${VALIDATION_CRITERIA.maxConsecutiveHighEffort} consecutive high-effort meals (effort > 3)
- Max ${VALIDATION_CRITERIA.maxRedMeatPerWeek} red meat meals per week
- No duplicate meals
- Only replace meals with same meal type (breakfast/lunch/dinner)
- Prefer lower effort meals (1-2) for replacements

Please analyze the issues and respond with ONLY a JSON object containing your recommended replacements:
<example_output>
{
  "replacements": [
    {
      "day": "Sunday",
      "mealType": "dinner",
      "oldMealId": 9,
      "newMealId": 50,
      "reason": "Replace high-effort meal"
    }
  ]
}
</example_output>
If no replacements are needed, return: {"replacements": []}`;

    // Use direct LLM call without tools for optimization recommendations
    const isCodex = process.argv.includes("--codex");
    const llm = isCodex 
      ? new FakeChatModel({})
      : new ChatOpenAI({ 
          temperature: 0,
          modelName: "gpt-4o-mini"
        });

    const result = await llm.invoke([{ role: "user", content: prompt }]);

    const llmResponse = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    console.log("📋 [LOG] LLM optimization result:", llmResponse);

    // Parse the LLM's JSON recommendations and apply them
    let optimizedPlan = { ...plan, days: [...plan.days] };
    
    try {
      const recommendations = JSON.parse(llmResponse);
      
      if (recommendations.replacements && Array.isArray(recommendations.replacements)) {
        for (const replacement of recommendations.replacements) {
          const { day, mealType, oldMealId, newMealId, reason } = replacement;
          const dayIndex = DAY_NAMES.indexOf(day as typeof DAY_NAMES[number]);
          const newMeal = availableMeals.find(m => m.id === newMealId);
          
          if (dayIndex >= 0 && newMeal && newMeal.mealType === mealType) {
            console.log(`🤖 [AGENT ACTION] Applying LLM recommendation: Replace ${day} ${mealType} (ID ${oldMealId}) with ${newMeal.mealName} (ID ${newMealId}) - ${reason}`);
            
            optimizedPlan.days = optimizedPlan.days.map(planDay => {
              if (planDay.dayIndex === dayIndex && planDay.mealType === mealType) {
                return {
                  ...planDay,
                  meal: {
                    id: newMeal.id,
                    name: newMeal.mealName,
                    effort: newMeal.relativeEffort,
                    hasRedMeat: newMeal.redMeat
                  }
                };
              }
              return planDay;
            });
          } else {
            console.log(`⚠️ [LOG] Invalid replacement recommendation: ${JSON.stringify(replacement)}`);
          }
        }
        
        console.log(`🤖 [AGENT ACTION] Applied ${recommendations.replacements.length} meal replacements`);
      } else {
        console.log("📋 [LOG] No replacements recommended by LLM");
      }
    } catch (error) {
      console.error("❌ [ERROR] Failed to parse LLM response as JSON:", error);
      console.log("📋 [LOG] Raw response:", llmResponse);
    }

    return optimizedPlan;
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
    console.log("✅ [RESULT] Generated meal plan:", JSON.stringify(plan, null, 2));
  } catch (error) {
    console.error("❌ [AGENT ERROR] Agent failed:", error);
  } finally {
    await agent.cleanup();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { MealPlannerAgent, VALIDATION_CRITERIA };