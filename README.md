# Meal Planner Monorepo

This repository contains a personal meal planning application composed of several services written in Go and TypeScript.  All projects are managed in a single Yarn workspace.

## Repository Structure

- **backend/** – Go REST API and business logic. Contains handlers, models, migrations and dummy data for offline use.
- **typescript/**
  - **ui/** – React application for the user interface.
  - **agent/** – LangGraph agent CLI for meal planning workflows.
  - **mcp/** – Express based MCP server used by the agent.
  - **shared/** – Reusable TypeScript types and utilities shared across packages.
- **scripts/** – Node and shell helpers for starting servers, running tests and database management.
- **db-backups/** – Example PostgreSQL backup files.
- **docker-compose.yml** – Local development services (PostgreSQL & pgAdmin).
- **codex-setup.sh** – Install and setup script used by Codex environments.

## Architecture Overview

The system is split into a Go backend and several TypeScript packages.  The backend exposes REST endpoints on port `8080` and persists data in PostgreSQL.  The React UI communicates directly with the backend during development.  The LangGraph agent is a command line tool that orchestrates meal plan generation and communicates with the backend or MCP server.  The MCP server exposes a Model Context Protocol API that proxies backend calls for the agent.  Shared TypeScript code lives in `typescript/shared` and is published to the workspace so all packages share a single set of types.

```
[React UI]  --->  [Go Backend]  --->  [PostgreSQL]
        ^              ^
        |              |
    [Agent CLI] ----> [MCP Server]
```

## Development Setup

1. **Install dependencies**
   ```bash
   yarn install
   (cd typescript && yarn install)
   (cd backend && go mod download)
   ```

2. **Install code generation tools**
   ```bash
   cd backend && make tools
   ```

3. **Generate code** (Protocol Buffers, OpenAPI, etc.)
   ```bash
   yarn generate_code
   ```

4. **Start Docker services** (PostgreSQL database)
   ```bash
   docker compose up -d
   ```

5. **Restore sample database**
   ```bash
   ./scripts/restore-db.js
   ```

6. **Build TypeScript packages** (required for tests and services)
   ```bash
   yarn workspace @meal-planner/shared build
   yarn build:agent
   yarn build:mcp
   ```

7. **Start the development servers**
   - Simple mode:
     ```bash
     cd backend && go run main.go --dummy
     ```
     ```bash
     cd typescript/ui && yarn start
     ```
   - Full environment (starts Docker and both servers):
     ```bash
     yarn dev
     ```

The `docker-compose.yml` file launches a PostgreSQL container and pgAdmin for local development.

## Root Package Scripts

| Script            | Description                                                  |
|-------------------|--------------------------------------------------------------|
| `yarn generate_code` | Generate Protocol Buffer, OpenAPI, and TypeScript client code from definitions. |
| `yarn start`      | Runs `scripts/start.js` which launches the Go backend and React frontend together. |
| `yarn start:mcp`  | Builds and launches the MCP server alongside the backend.    |
| `yarn dev`        | Starts Docker containers if necessary and then runs `yarn start`. |
| `yarn meal-agent` | Builds and runs the CLI agent from `typescript/agent`.       |
| `yarn test`       | Executes backend, frontend and agent test suites with a summary. |
| `yarn test:backend` | Run Go tests only.                                         |
| `yarn test:frontend` | Run React tests only.                                     |
| `yarn test:agent` | Run agent unit tests.                                        |
| `yarn build:agent` | Compile the agent TypeScript sources.                       |
| `yarn db:backup`  | Create a database backup using `scripts/backup-db.js`.       |
| `yarn db:restore` | Restore the database from a backup file.                     |
| `yarn kill:servers` | Kill processes started by the helper scripts.              |
| `yarn format`     | Run Prettier across the TypeScript workspaces.               |

## Testing

Run the full test suite from the repository root:

```bash
yarn workspace @meal-planner/shared build   # ensure shared types are compiled
yarn test
```

`yarn test` aggregates results for backend Go tests, frontend React tests and agent tests. Individual suites can be executed via `yarn test:backend`, `yarn test:frontend`, or `yarn test:agent`.

## Environment Configuration

- Go 1.22+ and Node.js 22 are expected. Versions are set in `codex-setup.sh`.
- Local development requires Docker for the PostgreSQL database. The backend can also run with the `--dummy` flag to use in-memory data.
- Environment variables for database configuration can be set in a `.env` file at the repository root.

## Contributing Workflow

1. Install dependencies with `yarn` and run `yarn test` to verify a clean state.
2. Make code or documentation changes.
3. Format code with `yarn format` and ensure `yarn test` passes.
4. Commit your changes following the guidelines in `CLAUDE.md` and `AGENTS.md`.

For additional design notes and high-level feature descriptions see `docs/MealPlannerSummary.md` if available.
