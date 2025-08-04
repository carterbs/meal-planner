# API Gateway - Development Guide

## Overview
The API Gateway is a Go-based HTTP-to-gRPC proxy that serves as the single entry point for the meal-planner application. It exposes REST endpoints and forwards requests to backend gRPC services (meal-service, agent-service, logging-service).

## Architecture
- **Language**: Go 1.24
- **Framework**: Chi router with middleware
- **Protocol Translation**: HTTP REST ↔ gRPC
- **Documentation**: Swagger/OpenAPI auto-generated
- **Hot Reload**: Air for development

## Directory Structure
```
api-gateway/
├── main.go              # Main server with all HTTP handlers
├── go.mod/go.sum        # Go dependencies
├── .air.toml            # Hot reload configuration
├── Dockerfile.dev       # Development container
├── docs/                # Auto-generated Swagger docs
│   ├── swagger.json
│   └── swagger.yaml
├── tmp/                 # Hot reload build artifacts
└── swagger_test.go      # Swagger generation tests
```

## Development Commands

### Local Development
```bash
# Run with hot reload (recommended)
air -c .air.toml

# Manual build and run
go build -o main
./main

# Run via Docker
docker-compose up api-gateway
```

### Code Generation
```bash
# Generate Swagger docs (from project root)
./scripts/gateway-gen.sh

# Manual swagger generation (from api-gateway/)
swag init --parseDependency --parseInternal --propertyStrategy camelcase
```

### Testing & Linting
```bash
# Run tests
go test ./... -v

# Run linting (from project root)
make lint
./scripts/lint.sh
```

## Key Features

### Service Connections
- **Meal Service**: `localhost:50051` (BACKEND_GRPC_ADDR)
- **Agent Service**: `localhost:50053` (AGENT_GRPC_ADDR)  
- **Logging Service**: `localhost:50052` (LOGGING_SERVICE_ADDR)
- **MCP Service**: `localhost:3001` (MCP_SERVICE_ADDR) - HTTP health check

### API Endpoints
- **Health**: `/api/health` - Multi-service health check
- **Meal Plans**: `/api/mealplan/*` - CRUD operations
- **Meals**: `/api/meals/*` - Recipe management
- **Shopping Lists**: `/api/shoppinglist` - Generate shopping lists
- **Agent Workflows**: `/api/agent/*` - AI meal planning
- **Workflow Management**: `/api/workflows/*` - Session persistence
- **Checkpoints**: `/api/checkpoints/*` - State persistence

### Swagger Documentation
- **UI**: `http://localhost:8090/swagger/index.html`
- **JSON**: `http://localhost:8090/swagger/doc.json`
- Auto-generated from code annotations

## Code Patterns

### Handler Structure
```go
// @Summary Description
// @Tags category
// @Param request body RequestType true "Description"
// @Success 200 {object} ResponseType "Success description"
// @Router /endpoint [method]
func (gw *Gateway) handlerName(w http.ResponseWriter, r *http.Request) {
    // 1. Parse request body/params
    // 2. Call backend gRPC service
    // 3. Use writeJSONResponse() for consistent output
}
```

### Error Handling
- gRPC status codes → HTTP status codes via `httpStatusFromGRPC()`
- Consistent JSON error responses via `writeJSONResponse()`
- Structured logging to logging-service

### Request Processing
- **JSON**: `protojson.Unmarshal()` for protobuf compatibility
- **Path Params**: `chi.URLParam()` for route parameters
- **Query Params**: `r.URL.Query().Get()` for filters

## Environment Variables
```bash
BACKEND_GRPC_ADDR=localhost:50051    # Meal service
AGENT_GRPC_ADDR=localhost:50053      # Agent service
LOGGING_SERVICE_ADDR=localhost:50052 # Logging service
MCP_SERVICE_ADDR=localhost:3001      # MCP service
```

## Dependencies
- **Chi**: HTTP router and middleware
- **gRPC**: Backend service communication
- **Protobuf**: Message serialization
- **Swaggo**: Swagger documentation generation
- **Air**: Hot reload development tool

## Build Integration
- **Root Makefile**: `make build` includes api-gateway
- **Docker Compose**: Full-stack development environment
- **Scripts**: Code generation and linting automation

## Common Tasks

### Adding New Endpoints
1. Add gRPC method to backend service
2. Add HTTP handler in `main.go`
3. Add route in router setup
4. Add Swagger annotations
5. Regenerate docs: `./scripts/gateway-gen.sh`

### Debugging
- Health endpoint shows all service status
- Structured logging via gRPC logging service
- Air provides hot reload for fast iteration
- Swagger UI for manual API testing

### Testing
- Unit tests in `swagger_test.go`
- Integration tests via e2e scripts
- Linting enforces Swagger annotation consistency