# Agent Service

AI-powered conversational meal planning service using LangGraph workflows. Exposes both gRPC services and direct CLI interfaces for meal plan generation and management.

## Core Technologies

- **LangGraph**: Workflow orchestration and state management
- **TypeScript**: Type-safe implementation with generated protobuf types
- **gRPC**: Service interface for backend integration
- **PostgreSQL**: Checkpoint persistence and message storage
- **OpenAI**: LLM integration for plan generation and optimization
- **MCP (Model Context Protocol)**: Backend communication layer

## Development Commands

```bash
# Development
yarn dev          # Run LangGraph agent with hot reload
yarn dev:grpc     # Run gRPC service with hot reload
yarn dev:cli      # Interactive CLI for testing

# Production
yarn build        # Compile TypeScript to dist/
yarn start        # Run LangGraph agent (dist/langgraph-agent.js)
yarn start:grpc   # Run gRPC service (dist/main.js)
yarn cli          # Run CLI interface (dist/cli.js)

# Testing
yarn test         # Run Jest test suite
yarn test:watch   # Run tests in watch mode
yarn clean        # Remove dist/ directory
```

## Key Components

- **LangGraphAgent** - Main agent orchestrating meal planning workflows
- **MealPlanningWorkflow** - Multi-step workflow: generate → optimize → present → feedback → finalize
- **gRPC Service** - Production API with workflow management endpoints
- **Database Repositories** - Checkpoint and message persistence
- **MCP Client** - Communication with backend meal/shopping services

## gRPC Service Endpoints

### Core Plan Operations
- `PlanStart` - Initialize new meal planning session with participants
- `PlanFeedback` - Add feedback to active workflow
- `PlanFinalize` - Finalize meal plan and generate shopping list
- `ResumeWorkflow` - Resume workflow with custom input parameters

### API Gateway Integration
- `StartAgentWorkflow` - High-level workflow initialization
- `MessageAgent` - Send messages and resume workflow processing
- `GetWorkflowStatus` - Get current workflow state and step
- `ListWorkflows` - List all active workflows (max 50)
- `CancelWorkflow` / `AbandonWorkflow` - Terminate workflows

### State Management
- `GetWorkflowState` - Retrieve meal plan, shopping list, and messages
- `GetCheckpoint` / `PutCheckpoint` / `ListCheckpoints` - Direct checkpoint access
- `GetMessages` / `AddMessage` - Conversation history management

### Health & Monitoring
- `HealthCheck` - Verify database, logging, and MCP service connectivity

## Database Schema

The service uses PostgreSQL with the following key tables:

**Checkpoints Table:**
- Stores LangGraph workflow state snapshots
- Schema: `thread_id`, `checkpoint_ns`, `checkpoint_data` (JSONB), `metadata` (JSONB)
- Used for workflow persistence and resume functionality

**Messages Table:**
- Conversation history for each workflow thread
- Schema: `id`, `thread_id`, `sender`, `content`, `created_at`
- Enables message persistence and retrieval

**Connection Management:**
- Uses `pg` library with connection pooling
- Database connection initialized in `database/connection.ts`
- Health checks verify database connectivity

## gRPC Implementation Details

**Server Configuration:**
- Protocol: gRPC with protobuf serialization
- Port: Configurable via `AGENT_SERVICE_PORT` (default: 50053)
- Message Limits: 4MB max send/receive message length
- Keepalive: 30s intervals with 5s timeout

**Error Handling:**
- Consistent error propagation via gRPC status codes
- UUID validation for thread IDs using regex patterns
- Graceful shutdown handling with SIGINT cleanup

**Service Registration:**
```typescript
// All endpoints registered in main.ts
server.addService(agentProto.AgentService.service, {
  planStart, planFeedback, planFinalize, resumeWorkflow,
  startAgentWorkflow, messageAgent, getWorkflowStatus,
  // ... additional endpoints
});
```

## LangGraph Integration

**Workflow Architecture:**
- State-based workflow execution using LangGraph
- Checkpoint persistence enables pause/resume functionality  
- Multi-step meal planning workflow with feedback loops

**State Management:**
- Canonical state type: `MealPlanningCheckpointState` from protobuf
- Database checkpointer for persistence: `shared/dbCheckpointer.ts`
- Thread-based isolation using UUID identifiers

**Workflow Steps:**
```typescript
enum MealPlanningStep {
  INITIATE = 'initiate',
  GENERATE_PLAN = 'generate_plan', 
  OPTIMIZE_PLAN = 'optimize_plan',
  PRESENT_PLAN = 'present_plan',
  AWAIT_FEEDBACK = 'await_feedback',
  APPLY_FEEDBACK = 'apply_feedback',
  PROCESS_FEEDBACK = 'process_feedback',
  FINALIZE_PLAN = 'finalize_plan',
  GENERATE_SHOPPING_LIST = 'generate_shopping_list',
  COMPLETE = 'complete'
}
```

## Development Notes

### Type Safety Requirements

**Strict TypeScript Configuration:**
- `strict: true` with `noUnusedLocals` and `noUnusedParameters` enabled
- Target ES2022 with Node16 module resolution
- **Avoid `any` casting** - Use generated protobuf types from `@mealplanner/generated`

**Type Definitions:**
- **Workflow State:** `MealPlanningCheckpointState` from generated protobuf as single source of truth
- **Database Models:** Explicit interfaces in `database/models.ts` matching Go structs
- **gRPC Messages:** Generated TypeScript types from protobuf definitions
- **Internal Types:** Zod schemas for runtime validation in `shared/types.ts`

**Generated Types Integration:**
```typescript
// Import generated protobuf types
import { MealPlanningCheckpointState } from '@mealplanner/generated';
import * as apipb from '@mealplanner/generated/api_pb';

// Use as canonical state type
export type MealPlanningState = MealPlanningCheckpointState;
```

### Project Structure
```
workflows/                    # LangGraph workflow definitions
├── meal-planning.ts         # Main workflow orchestration
├── conversation-handler.ts  # Message processing logic
├── feedback-handler.ts      # Feedback application workflows
└── factories.ts            # Workflow state factories

database/                    # PostgreSQL integration
├── connection.ts           # Database connection management
├── checkpoints.ts          # Workflow checkpoint persistence
├── messages.ts             # Conversation message storage
└── models.ts               # TypeScript interfaces for DB records

shared/                      # Common utilities and types
├── types.ts                # Workflow state definitions
├── dbCheckpointer.ts       # LangGraph checkpoint integration
└── mcp-types.ts            # MCP service type definitions

tests/                       # Comprehensive test suite
├── *.test.ts               # Individual test files
├── test-utils.ts           # Testing utilities
└── __mocks__/              # Mock implementations

io/                          # Input/Output handlers
├── ioHandler.ts            # Abstract I/O interface
└── cliHandler.ts           # CLI-specific implementation

utils/                       # Utility functions
├── formatMealPlan.ts       # Meal plan formatting
└── messageGenerator.ts     # Message generation helpers

# Core service files
handlers.ts                  # Individual gRPC method handlers
main.ts                      # Main gRPC server with all endpoints
langgraph-agent.ts          # Direct LangGraph agent interface
manager.ts                  # Workflow management logic
registry.ts                 # Service registry and initialization
logging.ts                  # Centralized logging utilities
```

### Environment Variables

**Required:**
```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=mealuser
DB_PASSWORD=mealpass
DB_NAME=mealplanner

# OpenAI Integration
OPENAI_API_KEY=your_openai_api_key
```

**Optional:**
```bash
# Service Configuration
AGENT_SERVICE_PORT=50053        # gRPC server port
MCP_HOST=localhost              # MCP service host
MCP_PORT=3001                   # MCP service port
```

> **Note:** Create a `.env` file in the service root with these variables. The service uses `--env-file=.env` for environment loading.

### Testing

**Test Configuration:**
- Uses Jest with TypeScript preset and ESM support
- Tests located in `/tests` directory with comprehensive coverage
- Mocks for CLI interactions and external dependencies

**Test Categories:**
- **Integration Tests:** Full workflow testing with mocked MCP calls
- **Unit Tests:** Individual workflow nodes and state management
- **Edge Cases:** Validation errors and workflow state transitions
- **Message Persistence:** Database interactions and conversation history

**Running Tests:**
```bash
yarn test                    # Run full test suite
yarn test:watch             # Run tests in watch mode
yarn test meal-planning     # Run specific test files
```

**Test Database:** Tests use the same PostgreSQL configuration as development

## Debugging & Troubleshooting

**Logging:**
- Centralized logging via `logging.ts` with `debugLog()` function
- CLI debug output written to `cli-debug.log`
- All gRPC operations logged with thread IDs and workflow steps

**Common Issues:**
1. **Database Connection Errors:** Verify PostgreSQL is running and environment variables are correct
2. **gRPC Timeout Issues:** Check MCP service health and network connectivity  
3. **Workflow State Corruption:** Use `GetCheckpoint` endpoint to inspect raw checkpoint data
4. **Memory Issues:** Monitor for LangGraph state accumulation in long-running workflows

**Health Check Debugging:**
```bash
# Test database connectivity
yarn dev:grpc
# In another terminal
grpcurl -plaintext localhost:50053 agent.AgentService/HealthCheck
```

**Development Tools:**
- Use `grpcurl` for manual gRPC endpoint testing
- PostgreSQL logs for database query debugging
- LangGraph execution traces via debug logging
