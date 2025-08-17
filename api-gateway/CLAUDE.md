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

# `api-gateway` – HTTP ↔︎ gRPC bridge in Go

## Purpose

The API gateway is a Go service that exposes a REST/HTTP interface to the
outside world and proxies requests to the internal gRPC services (agent,
meal, logging, etc.).  It uses the [`grpc-gateway`](https://github.com/grpc-ecosystem/grpc-gateway)
runtime to translate between HTTP JSON requests and gRPC messages defined
in `proto/`.  This service is also responsible for serving the generated
OpenAPI/Swagger documentation.

## Directory structure

* `cmd/api-gateway/` – The entry point for the gateway.  Contains a
  `main.go` that reads configuration and starts the HTTP server.
* `internal/` – Private packages for handling request routing and
  implementing translation logic.  Separate modules for each downstream
  service keep the code modular.
* `proto/` – Generated Go stubs from the shared `.proto` files.  Do not
  edit manually; update via `make proto` in the repository root.
* `swagger/` – The generated OpenAPI specification and related static
  files.  Use `make swagger` to update this when proto files change.

## Development commands

From the repository root run:

* `yarn workspace api-gateway install` – Install any Node dependencies if
  you extend the gateway’s Swagger tooling.
* `make proto` – Regenerate Go stubs used by the gateway.
* `make gateway` – Build the API gateway binary.  Equivalent to
  `go build ./cmd/api-gateway`.
* `make gateway-run` – Start the gateway in development mode.
* `make gateway-test` – Run Go tests.  Tests live under `internal/` and
  should use Go’s `testing` package with `httptest`.
* `make swagger` – Generate the OpenAPI JSON (`api.swagger.json`) from
  the proto definitions.

You can also use `docker-compose up api-gateway` to run the gateway
alongside its dependencies.

## Implementation guidelines

1. **Single source of truth.**  Do not define API schemas in Go structs.
   All request/response types are defined in `.proto` files inside the
   `proto` directory.  When adding a new REST endpoint you must first
   extend the relevant `.proto` file in the `proto` repository, assign
   appropriate field numbers, regenerate stubs and update downstream
   services accordingly.
2. **Modular handlers.**  Each gRPC method should have a dedicated
   HTTP handler function under `internal/`.  Keep translation logic
   focused; do not embed business logic in the gateway.  Forward the
   request to the gRPC client and return the response.
3. **Error handling.**  Convert gRPC errors to structured HTTP responses
   with meaningful status codes.  Use a consistent error format across
   endpoints.
4. **Swagger docs.**  When you add or update endpoints, regenerate the
   Swagger specification by running `yarn generate_code` from the root
   of the repository (`api.swagger.json`) and commit the updated
   file.  Do not hand‑edit the JSON; it is generated.
5. **Plan mode for new APIs.**  Before adding a new route, plan the
   changes: update the proto, regenerate code, implement handlers and
   tests.