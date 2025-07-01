# AGENTS.md

This file provides guidance to OpenAI Codex and other AI agents when working with code in this repository.

This repository contains a Go backend, React/TypeScript frontend, and TypeScript MCP server for a personal meal planning application. All dependencies should be pre-installed and ready to go.

## Codex-Specific Guidelines

### Agent Behavior
- **Scope**: These instructions apply to the entire directory tree rooted at this folder
- **Precedence**: Direct system/developer/user instructions take precedence over these guidelines
- **Compliance**: All code changes must follow these instructions for every file touched
- **Testing** If you start working on a test, and yarn:test fails, you should abort the task. Do not stop your task until tests are passing.

### Required Validation Checks
After making any code changes, you MUST run these validation commands and ensure they pass:

```bash
yarn test
```

This runs comprehensive tests across all components (Go backend, React frontend, TypeScript MCP server).

### Code Quality Requirements
- All new code must include appropriate tests
- Maintain existing test coverage levels
- Follow the Fix-Test-Commit workflow
- Use `yarn` package manager exclusively (never npm)
- Follow existing code patterns and architectural conventions

## Repository layout
- `backend/` – Go API server and database migrations
- `backend/mcp/` – TypeScript MCP server (port 3001)
- `frontend/` – React application
- `scripts/` – Node scripts for development and database management
- `docs/` – Project documentation
- `db-backups/` – PostgreSQL backups
- `docker-compose.yml` – PostgreSQL and pgAdmin services

## Development workflow
1. Start the development environment with:
   ```bash
   cd backend && go run main.go --dummy
   ```
   Start the frontend with
   ```bash
   cd frontend && yarn start
   ```

## Testing
- Run **all tests** from the root of the repo with:
  ```bash
  yarn test
  ```
  This executes Go tests and frontend tests and prints a summary.
- Individual suites can be run with `yarn test:backend` or `yarn test:frontend`.
- Backend coverage helpers are provided in `backend/Makefile` (`make coverage`). Frontend coverage can be generated with `yarn coverage` in `frontend`.
- Always run `yarn test` before committing changes.

## Code style
- Format Go code using `go fmt` before committing.
- The frontend relies on the defaults from `react-scripts`. Use consistent TypeScript/React style and run the tests to catch issues.

## Database utilities
- The agent is expected to run the backend using the `--dummy` flag, so modifying the real database is unnecessary.
- Database utilities exist for manual use:
  - `yarn db:backup` creates backups.
  - `yarn db:restore` restores from a backup (see `scripts/README.md`).
- SQL migrations live in `backend/migrations` and are applied automatically when the backend starts with a real database.

## Documentation
- High level architecture and features are described in `docs/MealPlannerSummary.md`.
- The frontend test strategy is documented in `frontend/TEST-IMPROVEMENTS.md`.

## When making changes
- Keep Go and TypeScript code well tested. Add unit tests in the appropriate `*_test.go` or `.test.tsx` files.
- Check the docs and update them if behavior changes.
- After modifications run:
  ```bash
  yarn test
  ```
  This command runs both backend and frontend test suites.

## Comprehensive Project Guidelines

For complete project information including:
- **Essential Commands**: All development, testing, and database management commands
- **Architecture Overview**: Detailed technical architecture and component relationships
- **Testing Requirements**: Complete testing strategy and coverage requirements
- **MCP Server Development**: TypeScript MCP server specific guidelines
- **Development Notes**: Package management, environment setup, and workflow details

**Refer to [CLAUDE.md](./CLAUDE.md) for comprehensive project guidelines and instructions.**

This AGENTS.md file provides Codex-specific guidance while CLAUDE.md contains the complete development reference for this meal planning application.

