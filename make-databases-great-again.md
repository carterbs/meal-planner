 Current Database Access Patterns for the agaent                                                                  
                                                                                                  
1. Single Database Interface                                                                                                                                                                        
- All agent database operations go through PostgresCheckpointSaver class in                       
/Users/bradcarter/Documents/Dev/meal-planner/typescript/agent/shared/checkpointer.ts              
- Uses PostgreSQL connection pooling via pg library with max 20 connections                       
- Handles all CRUD operations for workflow state persistence                                      
                                                                                                  
2. Large JSON Blob Storage in workflow_checkpoints Table                                          
                                                                                                  
- Schema: Single table workflow_checkpoints with JSONB columns                                    
- checkpoint_data: Stores entire workflow state as JSON blob including:                           
  - Complete meal plans (WeeklyMealPlan objects)                                                  
  - Shopping lists (ShoppingListItem[] arrays)                                                    
  - Formatted shopping list strings                                                               
  - Feedback history                                                                              
  - All workflow metadata                                                                         
- metadata: Additional JSONB column for workflow metadata                                         
                                                                                                  
3. Current JSON Storage Pattern                                                                   
                                                                                                  
- Everything gets serialized via JSON.stringify() into single JSONB blobs                         
- No normalization - meal plans, shopping lists stored as nested JSON                             
- No separate tables for meal plan or shopping list entities                                      
- Complete workflow state reconstructed from single JSON blob                                     
                                                                                                  
4. Specific Large Data Examples Found                                                             
                                                                                                  
- Lines 264-269: Meal plan storage in workflow state                                              
- Lines 623-797: Shopping list generation and storage                                             
- Lines 211-214: JSON serialization of complete state                                             
- Lines 127-155: Workflow state initialization with large objects                                 
                                                                                                  
5. Potential Issues with Current Approach                                                         
                                                                                                  
- Large JSON blobs could impact query performance                                                 
- No relational structure for meal plan/shopping list queries                                     
- Entire state must be loaded/saved for any updates                                               
- Difficult to query specific meal plan or shopping list data                                     
- Storage inefficiency for repeated data

# Proposed Solution

## Checkpoint Definition
A checkpoint represents a snapshot of the current meal plan at a specific point in time. It consists of:
- **Meal Plan**: The set of meals planned for the period

## Database Schema Design

### meal_plans table
| Column     | Type           | Notes                                            |
|------------|----------------|--------------------------------------------------|
| id         | SERIAL PRIMARY KEY | Unique identifier                              |
| thread_id  | TEXT NOT NULL  | Identifier for conversation or workflow thread   |
| version    | INTEGER NOT NULL| Monotonically increasing version per thread    |
| created_at | TIMESTAMP WITH TIME ZONE DEFAULT now() | Record creation timestamp  |

### meal_plan_items table
| Column          | Type                | Notes                                             |
|-----------------|---------------------|---------------------------------------------------|
| id              | SERIAL PRIMARY KEY  | Unique identifier                                 |
| meal_plan_id    | INTEGER NOT NULL    | Foreign key to meal_plans(id)                     |
| day_of_week     | SMALLINT NOT NULL   | 0=Sunday..6=Saturday                              |
| meal_type       | TEXT NOT NULL       | breakfast, lunch, dinner                          |
| meal            | JSONB NOT NULL      | Serialized Meal message                           |
| created_at      | TIMESTAMP WITH TIME ZONE DEFAULT now() | Record creation timestamp |

### messages table
| Column     | Type                           | Notes                               |
|------------|--------------------------------|-------------------------------------|
| id         | SERIAL PRIMARY KEY             | Unique identifier                   |
| thread_id  | TEXT NOT NULL                  | Identifier for conversation thread  |
| sender     | TEXT NOT NULL                  | "user" or "agent"                |
| content    | TEXT NOT NULL                  | Message content                     |
| created_at | TIMESTAMP WITH TIME ZONE DEFAULT now() | Message timestamp       |

## API Endpoints (Go Backend)
All endpoints use HTTP with strict JSON serialization/deserialization (via toJSON/fromJSON) and align with protobuf types.

1. **SaveMealPlan**
   - POST `/api/meal_plan`
   - Request Body: JSON `SaveMealPlanRequest { thread_id, version, entries: MealPlanEntry[] }`
   - Response Body: JSON `MealPlanIdentifier`
   - Invocation: the agent manager (`typescript/agent/manager.ts`) calls this endpoint to persist newly generated meal plans.

2. **SaveCheckpoint**
   - POST `/api/checkpoint`
   - Request Body: JSON `SaveCheckpointRequest { thread_id, version, entries: MealPlanEntry[] }`
   - Response Body: JSON `CheckpointResponse { success: boolean }`
   - Invocation: the TypeScript checkpointer (`typescript/agent/shared/checkpointer.ts`) calls this endpoint at the end of each step to record the current meal plan.

3. **SaveMessage**
   - POST `/api/workflows/{thread_id}/message`
   - Request Body: JSON `Message { thread_id, sender, content }`
   - Response Body: JSON `Message`
   - Invocation: the existing `/api/agent/message` handler (for both user feedback and agent responses) will call this endpoint to persist messages. The agent itself does not write to the database directly.
   - Interoperability: reuses the same message schema and validation as `/api/agent/message`, ensuring all workflow messages are captured.

4. **GetWorkflowState**
   - GET `/api/workflows/{thread_id}`
   - Response Body: JSON `WorkflowStateResponse { plan: MealPlanIdentifier, messages: Message[] }`
   - Invocation: the UI component (`typescript/ui/src/AgentPage.tsx`) calls this endpoint on load to hydrate the workflow state and message history.
   - Refactoring: update the existing `/api/workflows/{thread_id}` handler in `backend/main.go` to query the `meal_plans`, `meal_plan_items`, and `messages` tables and assemble the `WorkflowStateResponse`, replacing direct JSON-blob reads.

## Protobuf Definitions

Shared messages in `proto/mealplanner.proto`:
```proto
syntax = "proto3";
package mealplanner;

message WeeklyMealPlan {
  repeated Meal meals = 1;
}

message Meal {
  string name = 1;
  repeated Ingredient ingredients = 2;
}

message Ingredient {
  string name = 1;
  double quantity = 2;
  string unit = 3;
}

message MealPlanEntry {
  int32 day_of_week = 1; // 0=Sunday..6=Saturday
  string meal_type = 2;  // breakfast, lunch, dinner
  Meal meal = 3;
}

message SaveMealPlanRequest {
  string thread_id = 1;
  int32 version = 2;
  repeated MealPlanEntry entries = 3;
}

message MealPlanIdentifier {
  int32 id = 1;
  string thread_id = 2;
  int32 version = 3;
  string created_at = 4;
}

message SaveCheckpointRequest {
  string thread_id = 1;
  int32 version = 2;
  repeated MealPlanEntry entries = 3;
}

message CheckpointResponse {
  bool success = 1;
}

message Message {
  string thread_id = 1;
  string sender = 2; // "user" or "agent"
  string content = 3;
  string created_at = 4;
}

message WorkflowStateResponse {
  WeeklyMealPlan plan = 1;
  ShoppingList shopping_list = 2;
  repeated Message messages = 3;
}
```

## Workflow Implementation (Phased)
0. **Phase 0 – Create Tables** ✅
   - [x] Write and apply database migration scripts to create `meal_plans`, `meal_plan_items`, and `messages` tables.
   - [x] Verify tables exist and schema correctness.

1. **Phase 1 – Implement Go HTTP Endpoints** 🔄 In progress
   - Add HTTP handlers in Go for:
  - [ ] SaveMealPlan (`POST /api/meal_plan`)
  - [ ] SaveCheckpoint (`POST /api/checkpoint`)
  - [ ] SaveMessage (`POST /api/workflows/{thread_id}/message`)
  - [x] GetWorkflowState (`GET /api/workflows/{thread_id}`)
     • `SaveMealPlan` (`POST /api/meal_plan`)
     • `SaveCheckpoint` (`POST /api/checkpoint`)
     • `SaveMessage` (`POST /api/workflows/{thread_id}/message`)
     • `GetWorkflowState` (`GET /api/workflows/{thread_id}`)
   - Update the `/api/agent/message` handler to call the new `SaveMessage` endpoint instead of direct persistence, ensuring message storage is handled by the API layer.
   - Implement DB queries for `meal_plan`, `meal_plan_items`, and `messages` tables.
   - Run and confirm e2e tests pass.

2. **Phase 2 – Update Agent Checkpointer**
   - Refactor TypeScript checkpointer to call `/api/meal_plan` and `/api/checkpoint` HTTP endpoints.
   - Confirm e2e tests pass after changes.

## Migration Approach
- No data migration script needed; new workflows will write to the new table.

4. **Phase 4 – Migrate PostgresCheckpointSaver to Go Backend**
   - Replace remaining TypeScript database operations with HTTP API calls
   - Eliminate all PostgreSQL dependencies from TypeScript agent
   - Create fully stateless TypeScript workflow orchestrator

## Phase 4 No more Agent Database work

### Database Schema Changes

**Reuse existing `workflow_checkpoints` table** - no schema changes needed. After migration, `checkpoint_data` will be dramatically smaller:

```sql
-- Existing table remains unchanged, but checkpoint_data content shrinks from:
-- OLD (massive blob):
{
  "channel_values": {
    "threadId": "uuid",
    "meal_plan": { /* entire WeeklyMealPlan object */ },
    "feedback_history": [ /* array of all feedback */ ],
    "shopping_list": [ /* complete shopping list */ ],
    "current_step": "await_feedback",
    "iteration_count": 2,
    "is_finalized": false
  },
  "next": [],
  "step": 3
}

-- NEW (minimal workflow state):
{
  "channel_values": {
    "threadId": "uuid",
    "workflow_type": "meal_planning",
    "current_step": "await_feedback", 
    "iteration_count": 2,
    "is_finalized": false,
    "last_feedback_applied_at": "2024-01-01T00:00:00Z"
  },
  "next": [],
  "step": 3
}
```

### Protobuf Extensions

Add checkpoint-specific messages to `proto/api.proto`:

```proto
// LangGraph checkpoint persistence
message SimpleCheckpoint {
  map<string, google.protobuf.Any> channel_values = 1;
  repeated string next = 2;
  int32 step = 3;
}

message SimpleCheckpointMetadata {
  string source = 1;
  int32 step = 2;
  map<string, google.protobuf.Any> writes = 3;
  map<string, google.protobuf.Any> additional_fields = 4;
}

message CheckpointTuple {
  SimpleCheckpoint checkpoint = 1;
  SimpleCheckpointMetadata metadata = 2;
}

message GetCheckpointRequest {
  string thread_id = 1;
  string checkpoint_ns = 2; // optional - if empty, fetch latest
}

message GetCheckpointResponse {
  CheckpointTuple tuple = 1;
  bool found = 2;
}

message PutCheckpointRequest {
  string thread_id = 1;
  string checkpoint_ns = 2;
  string workflow_type = 3;
  SimpleCheckpoint checkpoint = 4;
  SimpleCheckpointMetadata metadata = 5;
}

message PutCheckpointResponse {
  bool success = 1;
  string thread_id = 2;
  string checkpoint_ns = 3;
}

message ListCheckpointsRequest {
  int32 limit = 1;
  string before_thread_id = 2; // optional pagination
}

message ListCheckpointsResponse {
  repeated CheckpointEntry entries = 1;
}

message CheckpointEntry {
  string thread_id = 1;
  string checkpoint_ns = 2;
  CheckpointTuple tuple = 3;
}
```

### Go Backend API Endpoints

Add new HTTP handlers in `backend/handlers/checkpoints.go`:

1. **GetCheckpoint**
   - GET `/api/checkpoints/{thread_id}`
   - Query parameter: `checkpoint_ns` (optional)
   - Response: `GetCheckpointResponse`
   - Replaces `PostgresCheckpointSaver.getTuple()`

2. **PutCheckpoint**
   - POST `/api/checkpoints`
   - Request Body: `PutCheckpointRequest`
   - Response: `PutCheckpointResponse`
   - Replaces `PostgresCheckpointSaver.put()`

3. **ListCheckpoints**
   - GET `/api/checkpoints`
   - Query parameters: `limit`, `before`
   - Response: `ListCheckpointsResponse`
   - Replaces `PostgresCheckpointSaver.list()`

### TypeScript Agent Refactoring

Replace `PostgresCheckpointSaver` with `HttpCheckpointSaver`:

```typescript
// typescript/agent/shared/httpCheckpointer.ts
export class HttpCheckpointSaver {
  private baseUrl: string;
  
  constructor(baseUrl: string = 'http://localhost:8090') {
    this.baseUrl = baseUrl;
  }

  async getTuple(config: RunnableConfig): Promise<[SimpleCheckpoint, SimpleCheckpointMetadata] | undefined> {
    const threadId = config.configurable?.threadId;
    const checkpointNs = config.configurable?.checkpoint_ns;
    
    if (!threadId) return undefined;
    
    const url = `${this.baseUrl}/api/checkpoints/${threadId}${checkpointNs ? `?checkpoint_ns=${checkpointNs}` : ''}`;
    const response = await fetch(url);
    
    if (!response.ok) return undefined;
    
    const data = await response.json();
    return data.found ? [data.tuple.checkpoint, data.tuple.metadata] : undefined;
  }

  async put(config: RunnableConfig, checkpoint: SimpleCheckpoint, metadata: SimpleCheckpointMetadata): Promise<RunnableConfig> {
    const threadId = config.configurable?.threadId || uuidv4();
    const checkpointNs = config.configurable?.checkpoint_ns || uuidv4();
    
    const response = await fetch(`${this.baseUrl}/api/checkpoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        workflow_type: metadata.workflow_type || 'meal_planning',
        checkpoint: checkpoint,
        metadata: metadata
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to save checkpoint: ${response.statusText}`);
    }
    
    return {
      configurable: {
        ...config.configurable,
        threadId,
        checkpoint_ns: checkpointNs
      }
    };
  }

  async *list(config: RunnableConfig, limit?: number): AsyncGenerator<[RunnableConfig, SimpleCheckpoint, SimpleCheckpointMetadata]> {
    const response = await fetch(`${this.baseUrl}/api/checkpoints?limit=${limit || 100}`);
    
    if (!response.ok) return;
    
    const data = await response.json();
    
    for (const entry of data.entries) {
      yield [
        {
          configurable: {
            threadId: entry.thread_id,
            checkpoint_ns: entry.checkpoint_ns
          }
        },
        entry.tuple.checkpoint,
        entry.tuple.metadata
      ];
    }
  }
}
```

### Package.json Updates

Remove PostgreSQL dependencies from TypeScript agent:

```json
{
  "devDependencies": {
    // Remove these:
    // "pg": "^8.8.0",
    // "@types/pg": "^8.6.6"
  }
}
```

### Implementation Steps

1. **Add checkpoint database table and migrations**
   - Create `workflow_checkpoints_v2` table
   - Add indexes for performance

2. **Extend protobuf definitions**
   - Add checkpoint-specific messages
   - Generate TypeScript and Go types

3. **Implement Go HTTP handlers**
   - Add `GetCheckpoint`, `PutCheckpoint`, `ListCheckpoints` endpoints
   - Add database service layer for checkpoint operations

4. **Create HttpCheckpointSaver**
   - Replace `PostgresCheckpointSaver` with HTTP-based implementation
   - Maintain same interface for LangGraph compatibility

5. **Update TypeScript dependencies**
   - Remove PostgreSQL client libraries
   - Update imports and configuration

6. **Integration testing**
   - Ensure LangGraph workflows continue to function
   - Test checkpoint persistence across workflow steps
   - Verify agent resumption from saved checkpoints

### Benefits of Phase 4

- **Zero database dependencies in TypeScript** - Agent becomes truly stateless
- **Simplified deployment** - No need to manage PostgreSQL connections in agent
- **Better separation of concerns** - All data persistence handled by Go backend
- **Improved scalability** - Agent can be easily containerized and scaled
- **Consistent API layer** - All database operations go through same HTTP interface`                                                          
                                                                                                  
 