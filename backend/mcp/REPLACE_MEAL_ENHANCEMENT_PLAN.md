# MCP Tools Enhancement Plan - Agent-Driven Meal Replacement

## Overview

Enhance the meal planner MCP tools to support agent-driven meal replacement by providing simple, focused tools that agents can orchestrate to make intelligent decisions about meal substitutions.

## Current State Analysis

### Existing Tool Issues
1. **API Mismatch**: replaceMeal tool sends `{dayIndex, newMealId}` but backend expects `{day, newMealId}`
2. **Missing Meal Type**: No way to specify breakfast/lunch/dinner for replacement
3. **Limited Context**: No tools to possible meals

### Backend Capabilities (Already Available)
- **Rich meal data**: Effort levels, red meat flags, meal types, last planned dates
- **Day-specific effort patterns**: Monday (0-2), Tue-Thu/Sat (3-5), Sunday (6-100)
- **Constraint tracking**: Red meat limits, temporal filtering
- **API endpoints**: `/api/meals`, `/api/meals/swap`, `/api/mealplan`

## Agent-Driven Architecture

### Tool Orchestration Flow
1. **Agent calls getMeals** → Gets list of available meals with metadata
2. **Agent calls getCurrentMealPlan** → Gets current meal plan context
3. **Agent reasons** → Considers constraints, effort levels, preferences
4. **Agent calls replaceMeal** → Executes the replacement decision

### Design Principles
- **Simple, focused tools** - Each tool does one thing well
- **Agent intelligence** - Let agents reason about meal selection
- **Rich data exposure** - Provide all data agents need to make good decisions
- **Clean separation** - Tools fetch/execute, agents decide

## Tool Specifications

### 1. getMeals Tool
**Purpose**: Fetch all available meals with rich metadata for agent decision-making

```typescript
getMealsArgs = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner']).optional().describe("Filter by meal type")
})

// Returns: Meal[] with full meal objects including:
// - id, mealName, relativeEffort, lastPlanned, redMeat, mealType
// - ingredients, steps, url
```

### 2. getCurrentMealPlan Tool  
**Purpose**: Get current meal plan state for context

```typescript
// No arguments needed
// Returns: WeeklyMealPlan with current meal assignments
```

### 3. Enhanced replaceMeal Tool
**Purpose**: Execute meal replacement with proper API integration

```typescript
replaceArgs = z.object({
  day: z.string().describe("Day to replace (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday)"),
  mealType: z.enum(['breakfast', 'lunch', 'dinner']).describe("Which meal type to replace"),
  newMealId: z.number().int().positive().describe("ID of the replacement meal")
})

// Fixed API call: POST /api/mealplan/replace with {day, mealType, newMealId}
```

### Agent Decision Support Data

Tools will expose all data agents need:

```typescript
interface Meal {
  id: number;
  mealName: string;
  relativeEffort: number;    // 0-100 for agent effort matching
  lastPlanned: string;       // ISO date for recency checking  
  redMeat: boolean;          // For red meat constraint logic
  mealType: string;          // breakfast/lunch/dinner matching
  url: string;
  ingredients: Ingredient[];
  steps: Step[];
}

interface WeeklyMealPlan {
  // Current meal assignments - agent can analyze current state
  days: DayMealPlan[];
}
```

## API Integration

### Tool-to-Backend Mapping
- **getMeals**: `GET /api/meals?type={mealType}`
- **getCurrentMealPlan**: `GET /api/mealplan`  
- **replaceMeal**: `POST /api/mealplan/replace` with `{day, mealType, newMealId}`

### API Requirements
- Ensure `/api/mealplan/replace` accepts `mealType` parameter
- Verify meal data includes all required fields (effort, redMeat, lastPlanned, etc.)

## Testing Strategy

### Tool Testing
- [ ] **getMeals tool** - Fetch meals with/without type filtering
- [ ] **getCurrentMealPlan tool** - Fetch current meal plan data
- [ ] **replaceMeal tool** - Execute meal replacement with proper parameters
- [ ] **Error handling** - Invalid inputs, API failures, network issues

## Success Criteria

### Tool Functionality
- ✅ **getMeals** returns complete meal data with proper filtering
- ✅ **getCurrentMealPlan** returns current meal plan state
- ✅ **replaceMeal** successfully updates meal plan via API
- ✅ All tools handle errors gracefully with helpful messages

### Agent Integration
- ✅ Agent can fetch meal data and current plan
- ✅ Agent can reason about meal selection using provided data
- ✅ Agent can execute meal replacement decisions
- ✅ Workflow completes in <5 seconds for typical cases

### Code Quality
- ✅ Type-safe implementations with proper Zod validation
- ✅ Comprehensive error handling and logging
- ✅ Clean, maintainable code structure
- ✅ Adequate test coverage for all tools