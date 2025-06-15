Implementation Plan

### The ReACT workflow
Reason: Check weekly plan for conflicts using these criteria:
- No more than 2 consecutive days with effort level > 3
- No more than 3 red meat meals per week  
- At least 2 kid-friendly meals (effort ≤ 2, no complex ingredients)
- No duplicate meals within the same week
Act: Use MCP tools to adjust the plan based on analysis. 

### Example flow:
Call generateMealPlan (no input) to create a draft plan.
Inspect each day. If the agent decides a meal is problematic, call getMeals, make the choice that you think my kids will like the most (and that doesn't conflict with existing meals), then call replaceMeal with { dayIndex, newMealId }.
When satisfied, call finalizeMealPlan to commit the plan.
Observation: Fetch the updated WeeklyMealPlan resource after each action to verify results.
Termination: Present the final plan to the user for approval. Optionally confirm before calling finalizeMealPlan.

## Implementation Logic

### Agent Loop
1. **Generate initial plan**: Call `generateMealPlan()`
2. **Analyze plan**: Check against criteria above
3. **Get replacement options**: `getMeals({ effort: ≤2 })` for kid-friendly
4. **Replace problematic meals**: `replaceMeal({ dayIndex, newMealId })`
5. **Repeat** until all criteria met
6. **Present to user** for approval
7. **Finalize**: `finalizeMealPlan()` and `generateShoppingList()`

### Error Handling
- Retry failed tool calls up to 3 times
- Log all tool requests/responses
- Graceful degradation if MCP server unavailable

### Connection Setup
```bash
# Start MCP server via stdio
cd backend/mcp && yarn start
```
Present the result
Format the final WeeklyMealPlan data into a human‑friendly summary.
Display it to the user for approval.
Once approved, invoke finalizeMealPlan if not already done.
After approval, call generateShoppingList to produce a list of ingredients for the week.
Log all tool calls and results for traceability.

## High level User flow

```mermaid
sequenceDiagram
    autonumber
    Scheduler->>Agent(Graph): trigger ("Saturday 07:00")
    Agent->>Tool: generateMealPlan()
    Agent->>Tool: getMeals()
    Tool-->>Agent: plan JSON
    Agent-->>User: Draft plan (needs approval)
    User-->>Agent: "Swap Monday dinner"
    loop until user says something like "looks good"
        Agent: assess meal plan, look at meals from getMeals(), pick a meal.
        Agent->>Tool: replaceMeal(day, mealType, newMealId)
        Agent-->>User: revised snapshot
    end
    Agent->>Tool: generateShoppingList(planId)
    Tool-->>Agent: shopping-list JSON
    Agent-->>User: Final list
```

## Using MCP tools for mealplanning

Do not reinvent the wheel, we already have an mcp server. Use it. Example:

```ts
import { McpClient } from "@modelcontextprotocol/sdk/client";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";

async function bootstrapAgent() {
  // 1 - connect to your server
  const mcp = new McpClient({ transport: "http://localhost:3000/mcp" });

  // 2 - discover every tool once
  const { tools: remoteTools } = await mcp.call("tools/list", {});   // JSON-RPC

  // 3 - convert each remote tool into a LangChain tool
  const tools = remoteTools.map((t: any) =>
    new DynamicStructuredTool({
      name: t.name,
      description: t.description,
      schema: t.inputSchema,                 // <-- already JSON-Schema
      func: async (args) =>
        (await mcp.call("tools/call", { name: t.name, arguments: args })).result
    })
  );

  // 4 - build the ReACT agent
  return createReactAgent({
    llm: new ChatOpenAI({ temperature: 0 }),
    tools
  });
}

export const agent = await bootstrapAgent();
```