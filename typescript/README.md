# TypeScript Monorepo

This folder contains all TypeScript code for Meal Planner. The repository uses **Yarn workspaces** to manage multiple packages in a single monorepo. The root `package.json` defines the workspaces and common scripts.

## Workspace Structure

```
typescript/
  agent/   - Conversational agent and workflows
  mcp/     - Model Context Protocol (MCP) server
  shared/  - Shared types and utilities
  ui/      - React front‑end
  tsconfig.json - base compiler settings
  style-guide.md
```

### agent
The **agent** package implements the Meal Planner conversational agent. It uses `@langchain` libraries and the MCP SDK to orchestrate workflows. Key files include:
- `langgraph-agent.ts` – entry point for the agent runtime
- `cli.ts` – command-line interface wrapper
- `workflows/` – meal planning logic
- `shared/` – agent-specific types that extend the `shared` package

Tests for the agent live under `agent/tests` and are executed with `yarn test:agent`.

### mcp
The **mcp** package exposes a standalone MCP server that communicates with the Go backend. The server registers resources and tools in `src/` and is started via `yarn start:mcp` or `scripts/start-mcp.js`.

### shared
The **shared** package contains TypeScript types such as `Meal`, `Step`, `WeeklyMealPlan` and constants like `DAYS_OF_THE_WEEK`. It builds to `dist/` and is consumed by both the agent and the UI.

### ui
The **ui** package provides the React front-end. It imports types from `@meal-planner/shared` and uses `react-scripts` for building and testing. Development mode can be started with `yarn start` from this directory.

## Build and Dependency Management

- The repository requires **Yarn 4** (`packageManager: "yarn@4.9.1"`).
- Each workspace defines its own `package.json` with dependencies and scripts.
- The root `package.json` contains shared scripts:
  - `yarn start` – starts the Go backend and the React UI
  - `yarn start:mcp` – builds and launches the MCP server with the backend
  - `yarn test` – runs backend, frontend, and agent tests via `scripts/test-summary.js`
- `codex-setup.sh` installs dependencies for all packages and runs `go mod download` for the backend.

## TypeScript Configuration

- `typescript/tsconfig.json` provides base compiler options (ES6 target, strict mode, JSX). The UI workspace extends this config.
- Each workspace has its own `tsconfig.json` that specifies output folders and module resolution.
- The agent and MCP packages compile to the `dist/` directory when `yarn build` is executed.

## Relationships Between Packages

- `@meal-planner/shared` exports common types used by **agent**, **mcp**, and **ui** packages.
- The **agent** communicates with the Go backend and MCP server, orchestrating meal planning workflows.
- The **ui** interacts with the backend directly and can leverage the MCP server for advanced planning features.
- The **mcp** server wraps backend endpoints and exposes them through the Model Context Protocol, enabling integration with the agent.

## Development Workflow

1. Run `yarn dev` to start Docker services and the application (see `scripts/dev-start.js`).
2. Alternatively, start only the backend and UI using `yarn start`.
3. For MCP development, run `yarn start:mcp` which builds the server and starts the backend automatically.
4. Always run `yarn test` before committing changes to execute tests across all workspaces.

For style conventions and UI design details see `style-guide.md`.
