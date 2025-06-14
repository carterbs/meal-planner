import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { API } from '../utils.js';

export interface WeeklyMealPlan {
  days: {
    date: string;
    mealId: number;
    mealName: string;
    effort: 'LOW' | 'MED' | 'HIGH';
  }[];
}

export async function fetchWeeklyMealPlan(): Promise<WeeklyMealPlan> {
  const response = await fetch(`${API}/api/mealplan`);
  if (!response.ok) {
    throw new McpError(-32000, `BackendError: ${response.statusText}`);
  }
  return response.json();
}

export function registerWeeklyMealPlan(server: McpServer) {
  server.resource<WeeklyMealPlan>('WeeklyMealPlan', fetchWeeklyMealPlan);
}
