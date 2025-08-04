# Scripts Directory

Essential automation scripts for developing the Meal Planner application. Most scripts are invoked via `yarn` commands from the repository root.

## Development Scripts

**`yarn dev`** - Start full development environment (Docker + frontend)
- Runs `docker-compose up -d && cd ui && yarn start`
- Uses `dev-start.js` which handles Docker container management and database readiness
- Use for typical daily development

**`yarn dev:rebuild`** - Rebuild everything from scratch
- Runs `docker-compose down && yarn generate_code && docker-compose build && docker-compose up -d && cd ui && yarn start`
- Complete rebuild including code generation and Docker containers

**`yarn dev:down`** - Stop Docker services
- Runs `docker-compose down`

**`yarn dev:restart`** - Restart Docker services
- Runs `docker-compose restart`

**`yarn dev:logs`** - View Docker logs
- Runs `docker-compose logs -f`

**`yarn start:mcp`** - Start MCP server only
- Runs `start-mcp.js` which builds and starts the MCP service
- Automatically kills existing processes on port 3001
- Sets environment variables for backend connectivity

**`yarn start:agent`** - Start agent service
- Runs agent service in development mode

**`yarn kill:servers`** - Kill processes on common ports
- Kills processes on ports: 8000, 8090, 5000, 3001, 3000, 50052, 50053, 50051
- Runs `kill-servers.js` - safe to run multiple times
- Run when ports are stuck or scripts fail

**`yarn meal-agent [args]`** or `./scripts/meal-agent.sh [args]`** - Agent CLI wrapper
- Verifies agent is built before running, builds if necessary
- Checks for environment configuration
- Passes all arguments to the agent CLI

## Code Generation

**`yarn generate`** or `make generate` - Generate all code from proto files
- Runs linting first, then generates all code
- Calls `generate_code.sh` which orchestrates:
  - `proto_gen.sh` - Generate Go/TypeScript from proto files
  - `gateway-gen.sh` - Generate OpenAPI docs with swagger transform
  - `ts-client-gen.sh` - Generate TypeScript client from OpenAPI

**`yarn generate_code`** - Generate code without linting
- Direct call to `generate_code.sh`

**`make swagger`** - Generate Swagger/OpenAPI documentation only
- Runs linting first, then calls `gateway-gen.sh`

**Proto utilities:**
- `gen_checkpoint.js` - Generate sample agent checkpoint (JavaScript)
- `inspect_checkpoint.ts` - Generate sample agent checkpoint (TypeScript)

## Testing & Quality

**`yarn test`** - Run all tests with summary
- Runs `test-summary.js` which executes and summarizes results from:
  - `test:backend` - Backend Go tests
  - `test:frontend` - Frontend React tests
  - `test:agent` - Agent service tests
  - `test:mcp` - MCP service tests
- Provides execution times and detailed pass/fail statistics

**Individual test commands:**
- `yarn test:backend` - Run backend tests only
- `yarn test:frontend` - Run frontend tests only  
- `yarn test:agent` - Run agent service tests only
- `yarn test:mcp` - Run MCP service tests only

**`yarn lint`** or `make lint` - Run all linting checks
- Runs `lint.sh` with custom Swagger response linter + Go linters + go vet

**`yarn format`** - Format code
- Runs Prettier on TypeScript files and gofmt on Go files

## Database Management

**`yarn db:backup`** - Create timestamped PostgreSQL backup
- Runs `backup-db.js` which creates backups in `db-backups/` directory
- Maintains maximum of 7 backups (configurable)
- Requires Docker container `meal-planner-db-1` to be running

**`yarn db:restore [backup-file]`** - Restore database backup
- Runs `restore-db.js` with interactive selection if no file specified
- Lists available backups with timestamps
- Includes confirmation prompts to prevent accidental data loss

## Build Commands

**`make build`** - Build all services
- Builds Go services (api-gateway, meal-service, logging-service)
- Builds Node.js services (agent-service, mcp-service, ui)

**`yarn build:agent`** - Build agent service only
**`yarn build:mcp`** - Build MCP service only

**`make clean`** - Clean build artifacts
- Removes compiled binaries and dist directories
- Safe to run to clean up build state

## End-to-End Testing

Manual test scripts for complex workflows:
- `e2e_backend_meal_removal.sh` - Test meal removal workflow
- `e2e_backend_meal_replacement.sh` - Test meal replacement workflow
- `e2e_message_workflow.sh` - Test agent messaging workflow
- `e2e_new_session_shopping_list.sh` - Test shopping list generation
- `e2e_remove_saturday.sh` - Test removing Saturday meals

All use `curl` + `jq` to test backend APIs and validate responses.

## Additional Utilities

**`make install-deps`** - Install development dependencies
- Installs Go tools (protoc-gen-go, swag, golangci-lint, etc.)
- Installs Node.js dependencies via yarn

**`make check`** - Quick check (lint + test without building)
**`make ci`** - Full CI pipeline (lint + generate + build + test)

**`yarn stop:logging`** - Kill logging service process on port 50052

## Quick Commands for Daily Development

```bash
# Start development
yarn dev                    # Full stack with Docker (recommended)
yarn dev:rebuild           # Rebuild everything from scratch

# Development utilities
yarn dev:logs              # View Docker container logs
yarn dev:restart           # Restart Docker services
yarn dev:down             # Stop Docker services

# Code generation 
yarn generate              # Generate all code from proto (with linting)
yarn generate_code         # Generate code without linting

# Testing
yarn test                  # All tests with summary
yarn test:backend          # Just backend tests
yarn test:frontend         # Just frontend tests
yarn test:agent           # Just agent tests

# Cleanup
yarn kill:servers          # Kill stuck processes
yarn format               # Format all code

# Database
yarn db:backup             # Backup before experiments
yarn db:restore            # Restore after experiments

# Agent CLI
yarn meal-agent --help     # Show agent CLI options
yarn meal-agent plan       # Plan meals using the agent
```

## Troubleshooting

- **Ports in use**: `yarn kill:servers` - kills processes on all common ports
- **Docker issues**: `yarn dev:down` then `yarn dev` - restart Docker environment
- **Generation fails**: Check proto files, ensure all dependencies installed via `make install-deps`
- **Tests fail**: Run individual test suites to isolate issues (`yarn test:backend`, etc.)
- **Agent CLI issues**: Check that `agent-service/.env` exists or environment variables are set
- **MCP server issues**: Ensure backend is running and accessible at `http://127.0.0.1:8090`
- **Database connection issues**: Verify PostgreSQL container is running with `docker-compose ps db`
