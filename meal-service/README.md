# Meal Service

A Go-based gRPC microservice that handles meal planning, recipe management, and shopping list generation for the meal-planner distributed system.

## Architecture

- **Language**: Go 1.23+ with gRPC/protobuf
- **Database**: PostgreSQL with connection pooling and automatic migrations  
- **Logging**: Structured logging via zap with gRPC logging service integration
- **Port**: 50051 (gRPC)
- **Health Checks**: Built-in gRPC health service with database connectivity monitoring

### Directory Structure
```
meal-service/
├── main.go              # gRPC server entry point with health monitoring
├── grpc_server.go       # MealPlannerAPIServer implementation  
├── services/            # Business logic layer with dependency injection
├── repositories/        # Data access layer with SQL prepared statements
├── models/              # Domain models and database migrations
├── db/                  # Database connection management with pooling
├── migrations/          # SQL schema migrations (auto-applied)
├── logging/             # Distributed logging with gRPC integration
├── server/              # Global service container and database reference
└── testutil/            # Testing utilities and builders
```

## Core Features

- **Meal Management**: Full CRUD operations for meals with ingredients and recipe steps
- **Meal Plan Generation**: Weekly meal planning with dietary constraints and red meat rotation
- **Shopping Lists**: Auto-generated consolidated shopping lists from selected meals
- **Recipe Steps**: Step-by-step cooking instructions with bulk operations and reordering
- **Agent Workflow Integration**: Checkpoint persistence and state management for AI agents
- **Health Monitoring**: Built-in health checks with database and logging service connectivity

## Development

### Prerequisites
- Go 1.23.0+ (uses toolchain go1.24.4)
- PostgreSQL database
- Optional: Logging service at `localhost:50052`

### Quick Start
```bash
# Install development tools
make tools

# Run with database connection
go run main.go

# Run with in-memory dummy data (no database required)
go run main.go --dummy
```

### Environment Variables
```bash
# Database configuration (required for non-dummy mode)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=mealplanner

# Optional logging configuration
LOGGING_SERVICE_ADDR=localhost:50052
VERBOSE_MEAL_PLAN_LOGS=true
```

### Build and Testing
```bash
# Install code generation tools
make tools

# Run all tests with verbose output
make test

# Generate coverage profile with function-level details
make coverage

# Open HTML coverage report
make coverage-html

# Clean generated files
make clean
```

## Database Schema

### Core Tables
- `meals` - Core meal data with metadata (name, effort, red meat flag, meal type)
- `ingredients` - Meal ingredients with quantities, units, and normalized names
- `recipe_steps` - Cooking instructions with step numbers and reordering support
- `meal_plans` - Generated meal plans with thread ID and version tracking
- `meal_plan_items` - Individual meal plan entries with day and meal type
- `workflow_checkpoints` - Agent workflow state persistence with JSONB data
- `messages` - Conversation history for agent workflows

### Connection Pool Configuration
- Max Open Connections: 25
- Max Idle Connections: 10
- Connection Max Lifetime: 5 minutes
- Connection Max Idle Time: 1 minute
- Connect Timeout: 5 seconds
- Ping Timeout: 3 seconds

## gRPC Service Definition

### Service Methods (from api.proto)
```protobuf
service MealPlannerAPI {
  // Health and status
  rpc HealthCheck(google.protobuf.Empty) returns (HealthCheckResponse);
  
  // Meal planning operations
  rpc GetMealPlan(google.protobuf.Empty) returns (GetMealPlanResponse);
  rpc GenerateMealPlan(google.protobuf.Empty) returns (GenerateMealPlanResponse);
  rpc FinalizeMealPlan(FinalizeMealPlanRequest) returns (FinalizeMealPlanResponse);
  
  // Meal CRUD operations
  rpc GetAllMeals(GetAllMealsRequest) returns (GetAllMealsResponse);
  rpc CreateMeal(CreateMealRequest) returns (CreateMealResponse);
  rpc UpdateMeal(UpdateMealRequest) returns (UpdateMealResponse);
  rpc SwapMeal(SwapMealRequest) returns (SwapMealResponse);
  rpc ReplaceMeal(ReplaceMealRequest) returns (ReplaceMealResponse);
  rpc DeleteMeal(DeleteMealRequest) returns (DeleteMealResponse);
  
  // Ingredient management
  rpc CreateMealIngredient(CreateMealIngredientRequest) returns (CreateMealIngredientResponse);
  rpc UpdateMealIngredient(UpdateMealIngredientRequest) returns (UpdateMealIngredientResponse);
  rpc DeleteMealIngredient(DeleteMealIngredientRequest) returns (DeleteMealIngredientResponse);
  
  // Recipe step management
  rpc GetSteps(GetStepsRequest) returns (GetStepsResponse);
  rpc AddStep(AddStepRequest) returns (AddStepResponse);
  rpc AddBulkSteps(AddBulkStepsRequest) returns (AddBulkStepsResponse);
  rpc UpdateStep(UpdateStepRequest) returns (UpdateStepResponse);
  rpc DeleteStep(DeleteStepRequest) returns (DeleteStepResponse);
  rpc ReorderSteps(ReorderStepsRequest) returns (ReorderStepsResponse);
  rpc DeleteAllSteps(DeleteAllStepsRequest) returns (DeleteAllStepsResponse);
  
  // Shopping list generation
  rpc GetShoppingList(GetShoppingListRequest) returns (GetShoppingListResponse);
  
  // Agent workflow and checkpoint management
  rpc GetWorkflowStatus(GetWorkflowStatusRequest) returns (GetWorkflowStatusResponse);
  rpc ListWorkflows(google.protobuf.Empty) returns (ListWorkflowsResponse);
  rpc CancelWorkflow(CancelWorkflowRequest) returns (CancelWorkflowResponse);
  rpc GetWorkflowState(GetWorkflowStateRequest) returns (GetWorkflowStateResponse);
  rpc AbandonWorkflow(AbandonWorkflowRequest) returns (AbandonWorkflowResponse);
  rpc AddMessage(AddMessageRequest) returns (AddMessageResponse);
  rpc GetMessages(GetMessagesRequest) returns (GetMessagesResponse);
  rpc GetCheckpoint(GetCheckpointRequest) returns (GetCheckpointResponse);
  rpc PutCheckpoint(PutCheckpointRequest) returns (PutCheckpointResponse);
  rpc ListCheckpoints(ListCheckpointsRequest) returns (ListCheckpointsResponse);
}
```

## Distributed Systems Patterns

### Connection Management
- **Connection Pooling**: Configured with reasonable defaults for high-load scenarios
- **Graceful Degradation**: Service starts even if database is unavailable
- **Health Monitoring**: Periodic health checks every 30 seconds with automatic status updates
- **Timeout Handling**: Proper context timeouts for database operations

### Error Handling
- **Structured Error Responses**: All gRPC errors include descriptive messages
- **Connection Error Detection**: Smart detection of database connectivity issues
- **Graceful Startup**: Non-blocking startup with connection retry logic

### Observability
- **Structured Logging**: Uses zap for structured JSON logging
- **gRPC Logging Integration**: Automatic log forwarding to centralized logging service
- **Health Check Integration**: Built-in health checks for Kubernetes readiness/liveness probes
- **Service Discovery**: Standard gRPC health service for load balancer integration

### Service Architecture
- **Clean Architecture**: Clear separation between services, repositories, and models
- **Dependency Injection**: ServiceContainer pattern for testable code
- **Repository Pattern**: Data access abstraction with interface-based mocking
- **Transaction Support**: Proper transaction handling with rollback mechanisms

## Integration with Other Services

- **API Gateway**: Exposes HTTP REST endpoints by proxying to this gRPC service
- **Logging Service**: Centralized log aggregation via gRPC at `localhost:50052`
- **Agent Service**: Workflow orchestration via checkpoint persistence and state management

## Production Considerations

- Database migrations run automatically on startup
- Connection pool sized for moderate concurrent load (25 max connections)
- Health checks support Kubernetes deployment patterns
- Graceful shutdown handling for clean container termination
- Structured logging for observability in distributed environments
