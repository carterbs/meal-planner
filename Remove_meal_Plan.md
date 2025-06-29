User Stories:
As a user, I want to be able to type into the chat "I want to skip all of saturday" and have the agent remove all of saturdays meals, and the UI update.
As a user, I want to be able to type into the chat "I want to skip Saturday breakfast/lunch/dinner" and have the agent remove saturday's breakfast, lunch, or dinner, and the UI update.

1. Backend API Endpoints (Go)

New HTTP Endpoint

- Route: POST /api/meals/remove
- Purpose: Direct meal removal from meal plan
- Payload: { "dayIndex": number, "mealType": string }
- Response: Updated meal plan with meal removed

Updated Agent Handler

- Endpoint: /api/agent/message
- Enhancement: Handle removal requests alongside existing swap functionality
- Integration: Pass removal commands to agent CLI with appropriate flags

2. Agent Workflow Processing (Node.js)

Enhanced MealPlanningWorkflow

- New Method: processRemovalRequest(message: string)
- LLM Integration: Parse natural language removal requests
- Tool Invocation: Call removeMeal MCP tool when needed

LLM Prompt Enhancement

Update the feedback processing prompt to handle both removal and replacement operations with a unified response format:

const prompt = `
Given this meal plan and user feedback: "${message}"
Respond with JSON containing any removals and/or replacements:
{
    "removals": [
      {
        "day": "Tuesday",
        "mealType": "dinner",
        "reason": "User requested removal"
      }
    ],
    "replacements": [
      {
        "day": "Wednesday",
        "mealType": "lunch",
        "currentMeal": "Salad",
        "newMeal": "Sandwich",
        "reason": "User prefers a heartier lunch"
      }
    ],
    "userMessage": "Updated your meal plan with the requested changes"
}
`;

2. MCP Server Implementation (TypeScript)

New Tool: removeMeal

// backend/mcp/src/tools/removeMeal.ts
export async function doRemoveMeal(
dayIndex: number, 
mealType: string
): Promise<WeeklyMealPlan> {
const resp = await fetch(`${API}/api/meals/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dayIndex, mealType })
});

if (!resp.ok) {
    throw new McpError(-32000, `BackendError: ${resp.statusText}`);
}

return resp.json();
}

Tool Registration

Add removeMeal to the MCP server's tool registry alongside existing swapMeal tool.

3. Backend Model Layer (Go)

Database Operations
- Function: RemoveMealFromPlan(dayIndex int, mealType string) error
- Implementation: Set meal reference to null/empty for specified day/type
- Validation: Ensure dayIndex and mealType are valid

Updated Meal Plan Structure

Modify meal plan JSON structure to handle null/empty meals:

type MealPlanDay struct {
    DayIndex int      `json:"dayIndex"`
    MealType string   `json:"mealType"`
    Meal     *Meal    `json:"meal"` // Pointer allows for nil/removed meals
}

4. Data Flow for Meal Removal

Complete Removal Flow
1. User Input: "Remove Tuesday dinner" or clicks remove button
2. Frontend: Sends message to /api/agent/message
3. Backend: Forwards to agent CLI with request
4. Agent Workflow:
- Sends request to LLM
- Calls removeMeal MCP tool if LLM's response includes removals
- Updates meal plan with removal
5. MCP Server: Calls backend /api/meals/remove endpoint
6. Backend: Removes meal from plan, returns updated plan
7. Frontend: Receives updated plan, highlights removed slot

Error Handling & Edge Cases

Validation
- Handle attempts to remove already-empty meal slots

User Experience
- Clear visual feedback for removed meals (empty state design)

Testing Strategy

Frontend Tests
- Component rendering with removed meals
- User interaction flows (button clicks, confirmations)
- Agent chat removal requests

Backend Tests
- API endpoint validation
- Database operations
- Error handling scenarios

MCP Server Tests
- Tool invocation with various parameters
- Error propagation from backend
- JSON response validation

Integration Tests
- End-to-end removal workflow
- Agent processing of removal requests
- Data consistency across all layers