# Centralized Logging Service

A gRPC-based logging service that aggregates logs from all services into a single rotating log file.

## Features

- **Centralized Logging**: All services log to a single unified log file
- **File Rotation**: Automatically rotates logs at 1MB, keeps 3 files
- **Structured JSON Logs**: Each log entry contains service, level, message, timestamp, and custom fields
- **gRPC API**: High-performance gRPC interface for log ingestion
- **Batch Logging**: Support for batch log operations for better performance

## Quick Start

1. **Start the logging service**:
   ```bash
   cd logging-service
   go run main.go
   ```
   The service runs on port 50052 by default.

2. **Use the Go client**:
   ```go
   import logger "logging-service/client/go"
   
   client, err := logger.NewLoggingClient("localhost:50052", "my-service")
   if err != nil {
       log.Fatal(err)
   }
   defer client.Close()
   
   // Simple logging
   client.Info(ctx, "User logged in", map[string]string{"user_id": "123"})
   
   // With thread ID and component
   client.LogWithDetails(ctx, "INFO", "Processing request", "req-456", "auth", fields)
   ```

3. **Use the TypeScript client**:
   ```typescript
   import { LoggingClient } from './client/ts/logger';
   
   const client = new LoggingClient('localhost:50052', 'my-service');
   await client.info('User logged in', { user_id: '123' });
   ```

## Log Format

Logs are written in JSON format with the following fields:
- `timestamp`: ISO 8601 timestamp
- `service`: Service name
- `level`: DEBUG, INFO, WARN, ERROR
- `message`: Log message
- `component`: Optional component/module name
- `thread_id`: Optional correlation ID
- `fields`: Custom key-value pairs

## Environment Variables

- `LOGGING_SERVICE_PORT`: Port to run the service on (default: 50052)

## Files

- `main.go`: Main logging service implementation
- `client/go/logger.go`: Go client library
- `client/ts/logger.ts`: TypeScript client library
- `test_client.go`: Test client demonstrating usage
- `logs/unified.log`: Unified log file (created automatically)