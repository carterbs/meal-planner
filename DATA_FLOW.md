# MCP Data Flow for Meal Plan Tools

## Overview
This document explains how data moves through the Meal Planner application when a user interacts with agent tools such as **SwapMeal**. Understanding this flow will help extend the system to handle additional meal plan modifications.


### 1. User Interaction (Frontend)
When the user types a message in the agent chat UI and presses send, `sendMessage` in `AgentPage.tsx` performs two HTTP requests:

```ts
await fetch("/api/agent/feedback", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    threadId: session.threadId,
    message: userMsg.text,
    from: "user",
  }),
});
const res = await fetch("/api/agent/resume", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    threadId: session.threadId,
    interactive: false,
  }),
});
```

_Source: `frontend/src/AgentPage.tsx` lines 182‑205_

The resume response includes an updated meal plan which is applied via `applyHighlights(newMealPlan)`.

### 2. Backend Agent Endpoints
The backend exposes `/api/agent/feedback` and `/api/agent/resume`. Both handlers invoke `runAgentCLI`, which spawns the Node based agent CLI:

```go
resp, err := runAgentCLI(ctx, "plan", "feedback", req.ThreadID, req.Message, "--from", req.From)
```

and

```go
resp, err := runAgentCLI(ctx, args...)
```

_Source: `backend/handlers/agent.go` lines 116‑124 and 144‑149_

### 3. Agent Workflow Processing
The CLI resumes the `MealPlanningWorkflow`. During feedback processing, the workflow calls `applyFeedbackWithLLM` which asks the LLM to suggest replacements. The prompt instructs the model to return JSON like `{ "replacements": [ ... ], "userMessage": "..." }`.

```ts
const result = await this.llm.invoke([{ role: "user", content: prompt }]);
const recommendations = JSON.parse(this.extractJsonFromResponse(llmResponse));
if (recommendations.replacements && Array.isArray(recommendations.replacements)) {
  for (const replacement of recommendations.replacements) {
    const { day, mealType, oldMealId, newMealId, reason } = replacement;
    const dayIndex = dayNames.indexOf(day);
    const newMeal = availableMeals.find(m => m.id === newMealId);
    if (dayIndex >= 0 && newMeal && newMeal.mealType === mealType) {
      updatedPlan.days = updatedPlan.days.map(planDay => {
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
    }
  }
}
```

_Source: `agent/workflows/meal-planning.ts` lines 312‑365_

The workflow can invoke MCP tools such as `swapMeal` to fetch alternatives from the backend when needed.

### 4. MCP Server Tool
The `swapMeal` tool is registered in the MCP server and issues a POST request to the Go backend:

```ts
export async function doSwapMeal(dayIndex: number): Promise<WeeklyMealPlan> {
  const resp = await fetch(`${API}/api/meals/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dayIndex })
  });
  if (!resp.ok) {
    throw new McpError(-32000, `BackendError: ${resp.statusText}`);
  }
  return resp.json();
}
```

_Source: `backend/mcp/src/tools/swapMeal.ts` lines 11‑21_

### 5. Backend SwapMeal Endpoint
The Go backend receives the swap request and selects a new meal:

```go
// SwapMealHandler handles POST /api/meals/swap and returns a new meal to replace the current one.
var payload struct {
    MealID   int    `json:"meal_id"`
    MealType string `json:"meal_type"`
}
if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
    http.Error(w, "Invalid request payload", http.StatusBadRequest)
    return
}
newMeal, err := models.SwapMeal(payload.MealID, payload.MealType, DB)
...
json.NewEncoder(w).Encode(newMeal)
```

_Source: `backend/handlers/meals.go` lines 55‑78_

### 6. Returning Data to the UI
After the workflow applies the LLM suggestions (and any MCP tool results), the CLI outputs a JSON structure containing the updated meal plan and a message. The backend forwards this JSON back to the frontend via the resume response. `AgentPage.tsx` then updates the UI with the new plan and highlights changed meals.

## Example Flow
1. **User input**: "Change out pasta for pizza".
2. **Frontend** sends feedback and resume requests as shown above.
3. **Backend** passes the message to the agent CLI.
4. **Agent workflow** uses the LLM and the `swapMeal` (or `replaceMeal`) tool to select a new meal.
5. **Backend** returns the modified meal plan.
6. **Frontend** receives the new plan and updates the display, highlighting the updated day.

This flow demonstrates how user feedback triggers tool calls through the MCP server and eventually results in an updated meal plan visible in the React UI.