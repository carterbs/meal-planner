# Meal Planner Monorepo

A microservices-based meal planning application with AI-powered meal plan generation. Built with Go backend services, TypeScript frontend/agents, and containerized development environment.

## Services Architecture

```
[React UI] ---> [API Gateway] ---> [Meal Service] ---> [PostgreSQL]
                      |                 |
                      v                 v
            [Agent Service] <---> [Logging Service]
                      |
                      v
              [MCP Service]
```

### Core Services
- **api-gateway/** – Go HTTP-to-gRPC proxy, main API entry point (port 8090)
- **meal-service/** – Go gRPC service for meal/recipe data and business logic (port 50051)  
- **agent-service/** – TypeScript LangGraph AI agent for meal planning workflows (port 50053)
- **mcp-service/** – Model Context Protocol server for agent interactions (port 3001)
- **logging-service/** – Centralized Go gRPC logging service (port 50052)
- **ui/** – React frontend application
- **shared/** – Shared TypeScript types across services

## Quick Start

```bash
# Install dependencies
yarn install

# Generate code (protobuf, OpenAPI, TypeScript clients)
make generate

# Start all services (PostgreSQL + all microservices)
docker-compose up -d

# Restore sample database
yarn db:restore

# Access the application
# UI: http://localhost:3000
# API: http://localhost:8090
# Swagger: http://localhost:8090/swagger/index.html
```


## Development Commands

```bash
# Build all services
make build

# Run all tests
make test
yarn test                    # Aggregate test results

# Individual service tests
yarn test:backend           # Go services
yarn test:frontend          # React UI
yarn test:agent            # Agent service
yarn test:mcp              # MCP service

# Code generation
make generate              # All code generation
yarn generate_code         # TypeScript only

# Database operations
yarn db:backup             # Backup current database
yarn db:restore            # Restore from backup

# Formatting & linting
yarn format               # Format TypeScript + Go
make lint                 # Run all linters

# Individual service commands
yarn start:agent          # Run agent CLI
yarn start:mcp           # Run MCP server
yarn dev                 # Start UI in dev mode
```

## Tech Stack

- **Backend**: Go 1.24, gRPC, PostgreSQL, Protocol Buffers
- **Frontend**: React 18, TypeScript 5.8, Yarn 4.9
- **AI/Agent**: LangGraph, OpenAI, Model Context Protocol
- **Infrastructure**: Docker Compose, Air (hot reload)
- **Code Gen**: protoc, Swagger/OpenAPI, Connect RPC

## Requirements

- Go 1.22+
- Node.js 22+  
- Docker & Docker Compose
- Protocol Buffers compiler (`protoc`)

## Key Files

- `CLAUDE.md` – Project development guidelines
- `Makefile` – Build automation and code generation
- `docker-compose.yml` – Full development environment
- `package.json` – Yarn workspace configuration
- Each service has its own `CLAUDE.md` with specific dev notes
