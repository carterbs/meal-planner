# Logging Service

Centralized gRPC-based logging service that aggregates structured logs from all services in the meal-planner system into rotating JSON log files.

## Architecture

**Core Components:**
- `main.go` - gRPC server with LoggingService implementation
- `client/go/logger.go` - Go client library with retry logic and zap integration
- `logs/` - Rotating log files (1MB max, 3 backups)

**Key Features:**
- Structured JSON logging with service, level, timestamp, thread_id, component, and custom fields
- Log rotation using lumberjack (1MB files, 3 backups)
- Batch logging support for performance
- Connection retry logic (30 attempts, 2s intervals)
- Graceful shutdown handling

## Dependencies

- **go.uber.org/zap** - Structured logging library
- **google.golang.org/grpc** - gRPC framework
- **gopkg.in/natefinch/lumberjack.v2** - Log rotation
- **mealplanner/generated/go** - Generated protobuf code

## Development commands

Use the validate tool from the repository root for testing, linting, and building:

```bash
# Run tests, linting, and building
yarn test --service logging-service
yarn lint --service logging-service
yarn build --service logging-service

# Development (from meal-planner root)
docker-compose up logging-service

# Direct run
cd logging-service
go run main.go
```

**Default Port:** 50052 (configurable via `LOGGING_SERVICE_PORT`)

## Usage

```go
import logger "logging-service/client/go"

client, err := logger.NewLoggingClient("localhost:50052", "my-service")
defer client.Close()

// Basic logging
client.Info(ctx, "User logged in", map[string]string{"user_id": "123"})

// With context details
client.LogWithDetails(ctx, "INFO", "Processing request", "req-456", "auth", fields)

// Zap integration
zapLogger := logger.NewZapLogger(client)
zapLogger.Info("Message", zap.String("key", "value"))
```