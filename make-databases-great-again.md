Migrate PostgresCheckpointSaver to Go Backend**
   - Replace remaining TypeScript database operations with HTTP API calls
   - Eliminate all PostgreSQL dependencies from TypeScript agent
   - Create fully stateless TypeScript workflow orchestrator

## No more Agent Database work
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
message AgentCheckpoint {
  map<string, google.protobuf.Any> channel_values = 1;
  repeated string next = 2;
  int32 step = 3;
}

message AgentCheckpointMetadata {
  string source = 1;
  int32 step = 2;
  map<string, google.protobuf.Any> writes = 3;
  map<string, google.protobuf.Any> additional_fields = 4;
}

message CheckpointTuple {
  AgentCheckpoint checkpoint = 1;
  AgentCheckpointMetadata metadata = 2;
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
  AgentCheckpoint checkpoint = 4;
  AgentCheckpointMetadata metadata = 5;
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

  async getTuple(config: RunnableConfig): Promise<[AgentCheckpoint, AgentCheckpointMetadata] | undefined> {
    const threadId = config.configurable?.threadId;
    const checkpointNs = config.configurable?.checkpoint_ns;
    
    if (!threadId) return undefined;
    
    const url = `${this.baseUrl}/api/checkpoints/${threadId}${checkpointNs ? `?checkpoint_ns=${checkpointNs}` : ''}`;
    const response = await fetch(url);
    
    if (!response.ok) return undefined;
    
    const data = await response.json();
    return data.found ? [data.tuple.checkpoint, data.tuple.metadata] : undefined;
  }

  async put(config: RunnableConfig, checkpoint: AgentCheckpoint, metadata: AgentCheckpointMetadata): Promise<RunnableConfig> {
    const threadId = config.configurable?.threadId || uuidv4();
    const checkpointNs = config.configurable?.checkpoint_ns || uuidv4();
    
    const response = await fetch(`${this.baseUrl}/api/checkpoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },

      // <important> In the actual implementation,
      //  use the proto toJSON methods rather than JSON.stringify </important>
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

  async *list(config: RunnableConfig, limit?: number): AsyncGenerator<[RunnableConfig, AgentCheckpoint, AgentCheckpointMetadata]> {
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

1. **Extend protobuf definitions**
   - Add checkpoint-specific messages
   - Generate TypeScript and Go types

2. **Implement Go HTTP handlers**
   - Add `GetCheckpoint`, `PutCheckpoint`, `ListCheckpoints` endpoints
   - Add CheckpointService layer for checkpoint operations

3. **Create HttpCheckpointSaver**
   - Replace `PostgresCheckpointSaver` with HTTP-based implementation
   - Maintain same interface for LangGraph compatibility

4. **Update TypeScript dependencies**
   - Remove PostgreSQL client libraries
   - Update imports and configuration

5. **Testing**
   - Ensure all backend unit tests pass. Agent and frontend are currently failing, and that's fine. Any new tests that you write for the agent MUST pass.