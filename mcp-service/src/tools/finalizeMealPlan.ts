import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { API } from '../utils.js';
import { z } from 'zod';
import { FinalizeMealPlanResponse } from '@mealplanner/generated';
export async function finalizePlan(threadId: string): Promise<FinalizeMealPlanResponse> {
    console.log(`🔧 [MCP-FINALIZE] Starting finalization for thread ID: ${threadId}`);

    const requestBody = {
        thread_id: threadId  // Backend expects snake_case JSON field
    };

    console.log(`🔧 [MCP-FINALIZE] Sending POST to ${API}/api/mealplan/finalize`);
    console.log(`🔧 [MCP-FINALIZE] Request body:`, JSON.stringify(requestBody, null, 2));

    const resp = await fetch(`${API}/api/mealplan/finalize`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    console.log(`🔧 [MCP-FINALIZE] Response status: ${resp.status} ${resp.statusText}`);

    if (!resp.ok) {
        const errorText = await resp.text();
        console.error(`🔧 [MCP-FINALIZE] Error response body: ${errorText}`);
        throw new McpError(-32000, `BackendError: ${resp.statusText}`);
    }

    const responseJson = await resp.json();
    console.log(`🔧 [MCP-FINALIZE] Success response:`, responseJson);

    return FinalizeMealPlanResponse.fromJson(responseJson);
}

export const finalzeArgs = z.object({
    threadId: z.string().describe("Thread ID of the workflow containing the meal plan to finalize")
});
export function registerFinalizeMealPlan(server: McpServer) {
    server.tool('finalizeMealPlan', 'Finalize the meal plan for the given thread ID.', {
        threadId: finalzeArgs.shape.threadId
    }, async ({ threadId }) => {
        console.log(`🔧 [MCP-FINALIZE] Tool called with args:`, JSON.stringify(threadId, null, 2));
        console.log(`🔧 [MCP-FINALIZE] Args type:`, typeof threadId);
        console.log(`🔧 [MCP-FINALIZE] Available keys in args:`, threadId && typeof threadId === 'object' ? Object.keys(threadId) : 'not an object');

        // Extract threadId from the arguments - it might be nested in the args structure
        if (!threadId || typeof threadId !== 'string' || threadId.trim() === '') {
            throw new McpError(-32602, 'threadId is required and must be a non-empty string');
        }

        console.log(`🔧 [MCP-FINALIZE] Processing thread ID: ${threadId}`);
        const result = await finalizePlan(threadId);
        console.log(`🔧 [MCP-FINALIZE] Tool returning result:`, result);
        return {
            content: [{ type: 'text', text: JSON.stringify(result) }]
        };
    });
}
