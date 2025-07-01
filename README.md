# Meal Planner Monorepo

This repository contains a multi-service meal planning application built with a Go backend and several TypeScript packages.  It is organized as a yarn workspace so all packages share a single lockfile.

## Repository Structure

- **backend/** – REST API written in Go.  Handles meal plan logic and stores data in PostgreSQL (or in-memory dummy data for development).  Includes migrations and tests.
- **typescript/** – Source for all TypeScript packages:
  - **ui/** – React frontend (Create React App).  Communicates with the Go API.
  - **agent/** – LangGraph based agent used for advanced planning workflows.
  - **mcp/** – Express server implementing the Model Context Protocol (MCP) that proxies requests to the backend.
  - **shared/** – Common TypeScript types shared by other packages.
  - `style-guide.md` – UI color palette and design notes.
- **scripts/** – Node helpers for starting services (`start.js`, `dev-start.js`, `start-mcp.js`), running the meal agent, managing the database, and summarising test results.
- **db-backups/** – Database dump files created by `yarn db:backup`.
- **docker-compose.yml** – Defines PostgreSQL and pgAdmin containers used in development.
- **codex-setup.sh** – Installs Go/Node dependencies for development.

The repository uses yarn workspaces with packages listed in the root `package.json`.

## Technology Stack

- **Backend:** Go (Chi router, PostgreSQL).  Supports running in `--dummy` mode with in-memory data.
- **Frontend:** React + TypeScript using `react-scripts`.
- **Agent & MCP:** Node/TypeScript using LangGraph and Express.  MCP implements the Model Context Protocol.
- **Database:** PostgreSQL via Docker compose.  Migrations live in `backend/migrations` and run automatically on startup.

## Component Relationships

1. The **frontend** communicates with the Go **backend** over REST on port `8080`.
2. The **agent** interacts with the backend and external language models, orchestrated through workflows exposed under `/api/agent`.
3. The optional **MCP server** (typescript/mcp) acts as a gateway speaking the Model Context Protocol while forwarding requests to the backend.
4. Type definitions in **typescript/shared** are imported by both the frontend and agent packages.

## Development Setup

1. **Install dependencies** (Go and Node 22 are required):
   ```bash
   yarn install
   pushd typescript && yarn install && popd
   pushd backend && go mod download && popd
   ```
   (Running `./codex-setup.sh` performs these steps automatically.)
2. **Start the backend** (with dummy data by default):
   ```bash
   cd backend && go run main.go --dummy
   ```
3. **Start the frontend**:
   ```bash
   cd typescript/ui && yarn start
   ```
   The UI proxies API requests to `localhost:8080`.
4. To run the MCP server alongside the backend use:
   ```bash
   yarn start:mcp
   ```
   which builds `typescript/mcp`, starts the database via Docker, then launches both the backend and MCP server.

### Package Scripts

The root `package.json` exposes several scripts:

- `yarn start` – Launches the backend and frontend together.
- `yarn start:mcp` – Launches the backend with the MCP server.
- `yarn dev` – Convenience script that ensures Docker is running then starts frontend and backend.
- `yarn test` – Runs backend, frontend, and agent test suites and prints a summary.
- `yarn test:backend` / `yarn test:frontend` / `yarn test:agent` – Run individual suites.
- `yarn build:agent` – Builds the TypeScript agent.
- `yarn db:backup` / `yarn db:restore` – Manage PostgreSQL backups.
- `yarn meal-agent` – Runs the command line agent (`scripts/meal-agent.sh`).
- `yarn kill:servers` – Terminates any running backend or MCP processes.
- `yarn format` – Formats TypeScript code using Prettier.

### Environment Configuration

Configuration values for the backend (database host, user, etc.) are read from environment variables.  A `.env` file can be placed in each package if custom values are needed.  Docker compose provides a local PostgreSQL instance on port `5432`.

### Testing Workflow

Before committing changes run:

```bash
yarn test
```

This executes Go tests in `backend`, React tests in `typescript/ui`, and Jest tests for the agent package.  Use the individual `test:*` scripts when developing specific parts of the system.  Backend coverage utilities are available via `make coverage` in the `backend` directory.

## Contributing

Follow the guidelines in `AGENTS.md` and `CLAUDE.md` for coding standards and workflow requirements.  Ensure `go fmt` is run on Go code and use Prettier for TypeScript.  Always run the full test suite before committing.

