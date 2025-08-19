import type { ShoppingListItem } from '@mealplanner/generated';
export type { ShoppingListItem };
// Types for MCP tool calls and responses
export type MCPToolResult = {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
};
// Shopping List Types
export interface ShoppingListRequest {
  plan: number[]; // Array of meal IDs
}
export type ShoppingListResponse = ShoppingListItem[];
// MCP Tool Names
export type MCPToolName =
  | 'generateMealPlan'
  | 'finalizeMealPlan'
  | 'generateShoppingList'
  | 'swapMeal'
  | 'replaceMeal';
// Type-safe MCP tool call function
export async function callMCPTool<TArgs extends Record<string, unknown>, TResponse>(
  client: { callTool: (req: { name: string; arguments: Record<string, unknown> }) => Promise<MCPToolResult> },
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
    const err = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse MCP tool response: ${err}`);
  }
}
