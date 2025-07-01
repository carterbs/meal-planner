// Types for MCP tool calls and responses
export type MCPToolResult = {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
};

// Shopping List Types
export interface ShoppingListItem {
  ingredient: string;
  quantity: string;
  category?: string; // Optional category for grouping items
}

export interface ShoppingListRequest {
  plan: number[]; // Array of meal IDs
}

export interface ShoppingListResponse extends Array<ShoppingListItem> {}

// Meal Plan Types
export interface WeeklyMealPlan {
  id?: number;
  days: Array<{
    dayIndex: number;
    mealType: string;
    meal: {
      id: number;
      name: string;
      effort: number;
      hasRedMeat: boolean;
    };
  }>;
}

// MCP Tool Names
export type MCPToolName =
  | 'generateMealPlan'
  | 'finalizeMealPlan'
  | 'generateShoppingList'
  | 'swapMeal'
  | 'replaceMeal';

// Type-safe MCP tool call function
export async function callMCPTool<TArgs, TResponse>(
  client: any, // TODO: Replace with proper MCP client type
  toolName: MCPToolName,
  args: TArgs,
): Promise<TResponse> {
  const result = await client.callTool({
    name: toolName,
    arguments: args,
  });

  if (result.isError) {
    throw new Error(
      `MCP tool error: ${result.content[0]?.text || 'Unknown error'}`,
    );
  }

  try {
    return JSON.parse(result.content[0]?.text || '{}') as TResponse;
  } catch (error) {
    throw new Error(`Failed to parse MCP tool response: ${error}`);
  }
}
