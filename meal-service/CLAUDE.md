# Meal Service

A Go-based gRPC microservice that handles meal planning, recipe management, and shopping list generation. This service has been migrated from HTTP to gRPC and integrates with a PostgreSQL database and logging service.

## Architecture

- **Language**: Go 1.23+ with protobuf/gRPC
- **Database**: PostgreSQL with automatic migrations
- **Logging**: Structured logging via zap + gRPC logging service integration
- **Port**: 50051 (gRPC)

### Key Components

- `main.go` - Service entry point with gRPC server setup and health checks
- `grpc_server.go` - gRPC service implementation (MealPlannerAPIServer)
- `services/` - Business logic layer with dependency injection
- `repositories/` - Data access layer with PostgreSQL queries
- `models/` - Domain models using protobuf types
- `db/` - Database connection management with connection pooling
- `migrations/` - SQL schema migrations (auto-applied on startup)

### Service Architecture

```
gRPC Server (port 50051)
├── MealPlannerAPIServer (main service)
├── Health Check Service
└── Periodic health monitoring
```

**Service Dependencies:**
- PostgreSQL database
- Logging service (gRPC client)
- Generated protobuf code from `/generated/go`

## Development

### Build & Run

```bash
# Install dependencies
go mod download

# Run with database
go run main.go

# Run with in-memory data (dummy mode)
go run main.go --dummy
```

### Environment Variables

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=mealplanner
```

### Testing

```bash
# Run all tests
make test

# Generate coverage report
make coverage

# View HTML coverage
make coverage-html
```

## Core Features

- **Meal Management**: CRUD operations for meals with ingredients and recipe steps
- **Meal Plan Generation**: Weekly meal planning with dietary constraints (red meat rotation)
- **Shopping Lists**: Automatically generated from meal selections
- **Recipe Steps**: Step-by-step cooking instructions with reordering
- **Health Checks**: Built-in gRPC health checking with database monitoring

## Database Schema

Key tables:
- `meals` - Core meal data with ingredients relationship
- `ingredients` - Meal ingredients with quantities/units
- `recipe_steps` - Cooking instructions with ordering
- `meal_plans` - Generated meal plans with versioning
- `workflow_checkpoints` - Agent workflow state persistence

## Development Notes

- Service gracefully handles database connectivity issues
- Supports both database and dummy (in-memory) modes
- All HTTP endpoints removed - now pure gRPC service
- Uses dependency injection pattern via ServiceContainer
- Comprehensive test coverage with mocks for repositories
- Database migrations run automatically on service startup