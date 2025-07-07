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
  MealPlanIdentifier plan = 1;
  repeated Message messages = 2;
}
```

## Workflow Implementation (Phased)
0. **Phase 0 – Create Tables** ✅
   - [x] Write and apply database migration scripts to create `meal_plans`, `meal_plan_items`, and `messages` tables.
   - [x] Verify tables exist and schema correctness.

1. **Phase 1 – Implement Go HTTP Endpoints**
   - Add HTTP handlers in Go for:
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

3. **Phase 3 – Cleanup and Deprecation**
   - Remove direct JSON-blob persistence and `PostgresCheckpointSaver` code paths.
   - Confirm e2e tests pass and deprecate old code.

## Migration Approach
- No data migration script needed; new workflows will write to the new table.

## Additional JSON Blob Cleanup
- Identify other JSONB usages (e.g., feedback_history, metadata) in `checkpointer.ts` and related modules.
- Refactor each into dedicated tables with strongly typed columns and foreign keys.
- Update TypeScript interfaces and database access layers accordingly.`                                                          
                                                                                                  
 