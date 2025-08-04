# Logging Service

Centralized gRPC logging service that aggregates structured logs from all services into rotating JSON log files.

## Tech Stack
- **Go 1.22** (toolchain: 1.24.4) with gRPC server
- **gRPC** with protobuf message definitions
- **Zap** for internal structured logging
- **Lumberjack** for log rotation (1MB files, 3 backups, no compression)
- **Air** for hot reloading in development
- **Protobuf** service definitions in `/proto/api.proto`

## Architecture

The service implements a centralized logging pattern for distributed systems:
- **gRPC Service**: Exposes `LoggingService` with `Log` and `LogBatch` RPCs
- **Client Library**: Go client with automatic retry logic and connection pooling
- **Log Aggregation**: Structured JSON logs with consistent formatting across services
- **Graceful Shutdown**: Signal handling for clean service termination

## Development

**Prerequisites:**
```bash
# Ensure Go 1.22+ is installed
go version

# Install Air for hot reloading (optional)
go install github.com/air-verse/air@latest
```

**Local development:**
```bash
cd logging-service
go mod download
go run main.go  # Runs on port 50052
```

**With hot reloading:**
```bash
cd logging-service
air  # Uses .air.toml configuration
```

**Docker development:**
```bash
# Build development image with Air hot reloading
docker build -f Dockerfile.dev -t logging-service-dev .
docker run -p 50052:50052 -v $(pwd):/app logging-service-dev
```

**Build and test:**
```bash
# Build binary
go build -o bin/logging-service .

# Run tests (if present)
go test ./...

# Format code
go fmt ./...

# Vet code
go vet ./...
```

## gRPC Service Definition

The service implements the `LoggingService` interface from `/proto/api.proto`:

```protobuf
service LoggingService {
  rpc Log(LogRequest) returns (LogResponse);
  rpc LogBatch(LogBatchRequest) returns (LogBatchResponse);
}
```

**LogEntry structure:**
- `service_name`: Source service identifier
- `level`: Log level (DEBUG, INFO, WARN, ERROR)  
- `message`: Log message content
- `timestamp`: RFC3339Nano formatted timestamp
- `thread_id`: Optional correlation/request ID
- `component`: Optional component/module name
- `fields`: Key-value pairs for structured data

## Client Usage

**Basic Go client:**
```go
import logger "logging-service/client/go"

// Create client with retry logic (30 attempts, 2s delays)
client, err := logger.NewLoggingClient("localhost:50052", "my-service")
if err != nil {
    log.Fatalf("Failed to connect to logging service: %v", err)
}
defer client.Close()

// Simple logging methods
ctx := context.Background()
client.Info(ctx, "User logged in", map[string]string{"user_id": "123"})
client.Error(ctx, "Database connection failed", map[string]string{
    "error": "connection timeout",
    "database": "postgres",
})

// Detailed logging with thread ID and component
client.LogWithDetails(ctx, "ERROR", "Auth failed", "req-456", "auth", map[string]string{
    "username": "john_doe",
    "ip": "192.168.1.100",
})
```

**Zap wrapper (recommended for Go services):**
```go
import (
    "go.uber.org/zap"
    logger "logging-service/client/go"
)

client, err := logger.NewLoggingClient("logging-service:50052", "meal-service")
if err != nil {
    log.Fatalf("Failed to connect: %v", err)
}
defer client.Close()

zapLogger := logger.NewZapLogger(client)
zapLogger.Info("Processing request", 
    zap.String("user_id", "123"),
    zap.Int("request_size", 1024),
    zap.Bool("authenticated", true),
)
```

**Batch logging for high throughput:**
```go
import pb "mealplanner/generated/go"

entries := []*pb.LogEntry{
    {
        ServiceName: "meal-service",
        Level:       "INFO",
        Message:     "Batch operation started",
        Timestamp:   timestamppb.Now(),
        Fields:      map[string]string{"batch_id": "123"},
    },
    // ... more entries
}

err := client.LogBatch(ctx, entries)
if err != nil {
    log.Printf("Batch logging failed: %v", err)
}
```

## Key Features

### Connection Management
- **Auto-retry connection** with 30 attempts and 2-second delays
- **Connection timeout** of 5 seconds per attempt
- **Graceful degradation** when logging service is unavailable

### Log Processing
- **Structured JSON logs** with consistent schema across all services
- **Automatic timestamping** with RFC3339Nano precision
- **Batch processing** support for high-throughput scenarios
- **Field validation** with proper error responses

### Operational Features
- **Log rotation** at 1MB with 3 backup files in `./logs/`
- **Graceful shutdown** with SIGINT/SIGTERM signal handling
- **gRPC interceptors** for request debugging and error handling
- **Service introspection** with method listing on startup

### Distributed Systems Patterns
- **Request correlation** via thread_id field
- **Service identification** for distributed tracing
- **Error propagation** with proper gRPC status codes
- **Observability** through structured internal logging

## Configuration

### Environment Variables
- `LOGGING_SERVICE_PORT`: Service port (default: 50052)

### File Structure
```
logging-service/
├── main.go              # Service implementation
├── go.mod               # Module dependencies  
├── client/go/           # Go client library
│   ├── logger.go        # Client implementation
│   └── go.mod           # Client dependencies
├── logs/                # Rotating log files
│   └── unified.log      # Current log file
├── tmp/                 # Build artifacts (air)
├── Dockerfile.dev       # Development container
└── .air.toml           # Hot reload configuration
```

### Log File Format
Each log entry is written as a single JSON line:
```json
{
  "timestamp": "2025-08-04T13:27:06.618123456Z",
  "service": "meal-service", 
  "level": "INFO",
  "message": "Processing meal request",
  "component": "handler",
  "thread_id": "req-123",
  "fields": {
    "user_id": "456",
    "meal_id": "789"
  }
}
```

## Deployment Considerations

### Production Setup
- Deploy as a singleton service (not horizontally scaled)
- Use persistent volumes for log file storage
- Monitor disk usage for log rotation
- Set up log shipping to external systems (ELK, Splunk, etc.)

### Health Monitoring  
- Monitor gRPC service health and response times
- Track log ingestion rates and batch processing metrics
- Alert on connection failures from client services
- Monitor disk space in logs directory

### Security
- Use TLS for production gRPC connections
- Implement authentication/authorization if needed
- Sanitize log content to prevent log injection attacks
- Consider log data retention and privacy requirements

## Troubleshooting

**Connection issues:**
- Check service is running on correct port
- Verify network connectivity between services
- Review client retry logs for connection attempts

**Performance issues:**
- Use batch logging for high-volume scenarios
- Monitor log file sizes and rotation
- Check for gRPC connection pooling in clients

**Missing logs:**
- Verify client error handling doesn't swallow logging errors
- Check service internal logs for processing errors
- Ensure proper context cancellation in clients