import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { API } from '../utils.js';
import { GetMealPlanResponse } from '@mealplanner/generated';
export async function fetchWeeklyMealPlan(): Promise<GetMealPlanResponse> {
    const response = await fetch(`${API}/api/mealplan`);
    if (!response.ok) {
        throw new McpError(-32000, `BackendError: ${response.statusText}`);
    }
    return await response.json() as GetMealPlanResponse;
}
export function registerWeeklyMealPlan(server: McpServer) {
    server.resource('WeeklyMealPlan', 'meal://plan/weekly', {
        description: 'Get the current weekly meal plan showing planned meals for each day of the week with dates, meal names, and effort levels (LOW/MED/HIGH)',
        mimeType: 'application/json'
    }, async () => {
        const data = await fetchWeeklyMealPlan();
        return {
            contents: [{
                    uri: 'meal://plan/weekly',
                    text: JSON.stringify(data, null, 2),
                    mimeType: 'application/json'
                }]
        };
    });
}
