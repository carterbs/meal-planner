# Next Steps: Agent Frontend Integration

## Summary
Successfully implemented and tested the agent backend API endpoints. The agent can now generate meal plans, process user feedback, and maintain workflow state. Next step is to build a frontend chat interface to interact with these endpoints.

## API Endpoints & Examples

### 1. Start New Meal Planning Session
**POST** `/api/agent/start`

**Request:**
```json
{
  "participants": ["brad", "shannon"],
  "workflow_type": "meal_planning"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Meal planning session started",
  "threadId": "aa9caab4-ff07-428a-82da-2b4e0e1c3824",
  "currentStep": "started"
}
```

### 2. Add Feedback to Session
**POST** `/api/agent/feedback`

**Request:**
```json
{
  "thread_id": "aa9caab4-ff07-428a-82da-2b4e0e1c3824",
  "message": "We shouldn't have baked spaghetti and spaghetti in the same week - too much pasta. Can you replace one with something different?",
  "from": "brad"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Feedback added successfully from brad"
}
```

### 3. Resume/Process Workflow
**POST** `/api/agent/resume`

**Request:**
```json
{
  "thread_id": "aa9caab4-ff07-428a-82da-2b4e0e1c3824",
  "interactive": false
}
```

**Response:**
```json
{
  "message": "Failed to resume workflow: undefined",
  "raw": {
    "meal_plan": {
      "days": [
        {
          "meal": {
            "id": 57,
            "name": "Eggs, Toast, and Fruit",
            "effort": 2,
            "hasRedMeat": false
          },
          "dayIndex": 0,
          "mealType": "breakfast"
        },
        // ... more meals
      ]
    },
    "thread_id": "aa9caab4-ff07-428a-82da-2b4e0e1c3824",
    "created_at": "2025-06-16T00:33:22.003Z",
    "updated_at": "2025-06-16T00:35:53.639Z",
    "current_step": "await_feedback",
    "is_finalized": false,
    "participants": ["brad"],
    "shopping_list": null,
    "workflow_type": "meal_planning",
    "iteration_count": 2,
    "feedback_history": [
      {
        "from": "brad",
        "message": "We shouldn't have baked spaghetti and spaghetti in the same week - too much pasta. Can you replace one with something different?",
        "timestamp": "2025-06-16T00:35:08.746Z",
        "meal_plan_version": 1
      }
    ],
    "last_feedback_applied_at": "2025-06-16T00:35:08.746Z"
  }
}
```

### 4. Get Workflow Status
**GET** `/api/agent/status/{threadId}`

**Response:**
```json
{
  "success": true,
  "threadId": "aa9caab4-ff07-428a-82da-2b4e0e1c3824",
  "currentStep": "await_feedback",
  "message": "Workflow status: await_feedback",
  "raw": {
    "threadId": "aa9caab4-ff07-428a-82da-2b4e0e1c3824",
    "workflowType": "meal_planning",
    "participants": ["brad"],
    "createdAt": "2025-06-16T04:33:24.109Z",
    "lastUpdated": "2025-06-16T04:35:53.641Z",
    "currentStep": "await_feedback",
    "isActive": true
  }
}
```

### 5. List All Workflows
**GET** `/api/agent/workflows`

**Response:**
```json
{
  "success": true,
  "message": "All workflows retrieved",
  "raw": [
    {
      "threadId": "aa9caab4-ff07-428a-82da-2b4e0e1c3824",
      "workflowType": "meal_planning",
      "participants": ["brad"],
      "createdAt": "2025-06-16T04:33:24.109Z",
      "lastUpdated": "2025-06-16T04:35:53.641Z",
      "currentStep": "await_feedback",
      "isActive": true
    }
    // ... more workflows
  ]
}
```

### 6. Cancel Workflow
**DELETE** `/api/agent/workflows/{threadId}`

**Response:**
```json
{
  "success": true,
  "message": "Workflow cancelled successfully"
}
```

## Frontend Implementation Plan

### New `/agent` Route
Create a new page at `/agent` with the following features:

#### 1. Chat Interface Components
- **Chat History** - Display conversation history with the agent
- **Message Input** - Text input for user feedback/requests
- **Send Button** - Submit messages to the agent
- **Working Indicator** - Show when agent is processing (spinning loader, etc.)

#### 2. Meal Plan Display
- **Formatted Meal Plan** - Nice table/card layout showing:
  - Days of the week (Sunday-Saturday)
  - Breakfast, Lunch, Dinner for each day  
  - Effort indicators (🔥 symbols)
  - Red meat indicators (🥩 symbol)
- **Plan Updates** - Animate/highlight changes when agent modifies the plan

#### 3. Session Management
- **New Session Button** - Start a fresh meal planning session
- **Session List** - Dropdown/sidebar to switch between active sessions
- **Session Status** - Display current workflow step and last updated time

#### 4. Key Features
- **Auto-refresh** - Poll for updates when agent is working
- **Error Handling** - Display user-friendly error messages
- **Loading States** - Show appropriate loading indicators
- **Responsive Design** - Works well on mobile and desktop
- **Copy Functionality** - Integration with existing copy features from main app

#### 5. Copy Integration
Incorporate the existing copy functionality from the main meal planner view:

- **Copy Meal Plan Button** - Copy formatted meal plan to clipboard (HTML table format)
- **Copy Shopping List Button** - Copy generated shopping list to clipboard
- **Export Options** - Same export capabilities as main view (calendar .ics files, etc.)
- **Format Consistency** - Use same formatting logic as existing views for consistency

The agent workflow provides `meal_plan` and `shopping_list` data in the response, which can be processed using the existing utility functions:
- Leverage existing `formatMealPlan()` utilities
- Reuse shopping list formatting logic
- Maintain consistent styling and emoji indicators (🔥 for effort, 🥩 for red meat)

### Technical Implementation

#### API Integration
```typescript
// Create API service functions
const agentAPI = {
  startSession: (participants: string[]) => POST('/api/agent/start', ...),
  addFeedback: (threadId: string, message: string, from: string) => POST('/api/agent/feedback', ...),
  resumeWorkflow: (threadId: string) => POST('/api/agent/resume', ...),
  getStatus: (threadId: string) => GET(`/api/agent/status/${threadId}`),
  listWorkflows: () => GET('/api/agent/workflows'),
  cancelWorkflow: (threadId: string) => DELETE(`/api/agent/workflows/${threadId}`)
}
```

#### State Management
```typescript
interface AgentState {
  currentThreadId: string | null;
  chatHistory: ChatMessage[];
  currentMealPlan: MealPlan | null;
  isWorking: boolean;
  sessions: WorkflowSession[];
  error: string | null;
}
```

#### Meal Plan Component
- Parse the meal plan data structure from API responses
- Format into a weekly calendar view
- Highlight recent changes/updates
- Make it visually appealing with proper spacing and colors

### User Experience Flow
1. User visits `/agent`
2. Click "Start New Meal Plan" to begin
3. Agent generates initial plan and displays it
4. User can provide feedback via chat
5. Agent processes feedback and updates plan
6. Repeat until user is satisfied
7. Option to finalize plan and generate shopping list

### Priority Features
1. ✅ Basic chat interface
2. ✅ Meal plan display component  
3. ✅ Session management
4. ✅ Loading/working indicators
5. ✅ Copy meal plan & shopping list functionality
6. ⭐ Polish and responsive design

### Integration Notes
- Reuse existing copy/export utilities from the main meal planner
- Maintain consistent UI patterns and styling
- Agent-generated plans should have same visual format as manually created ones
- Shopping lists from agent should be copyable in same format as manual shopping lists

This will provide a much more user-friendly way to interact with the meal planning agent compared to CLI commands, while maintaining consistency with the existing application's functionality.