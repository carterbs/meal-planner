# Meal Planner TypeScript Monorepo

This directory houses all TypeScript packages for the Meal Planner application. Each package is managed through the Yarn workspaces defined in the repository root `package.json`.

## Workspace Structure

```
typescript/
├─ agent/   - LangGraph based meal planning agent
├─ mcp/     - Model Context Protocol server
├─ ui/      - React frontend
├─ shared/  - Shared utilities and TypeScript types
├─ public/  - Static assets
├─ tsconfig.json - Base compiler options
└─ style-guide.md - UI design notes
```

### Packages

- **ui** – React application located in `typescript/ui`. It communicates with the Go backend through the MCP server and reuses code from `shared`.
- **agent** – Node.js LangGraph agent found in `typescript/agent`. It also imports utilities from `shared` and interacts with the backend.
- **mcp** – Express server in `typescript/mcp` implementing the [Model Context Protocol](https://github.com/modelcontextprotocol/sdk). Acts as a bridge between the TypeScript packages and the Go backend.
- **shared** – Reusable TypeScript types and helper functions consumed by `ui`, `agent`, and `mcp`.

## Build and Development

The repository uses Yarn v4 workspaces for dependency management. All packages are listed in the root `package.json` under the `workspaces` field:

```
"workspaces": [
  "typescript/ui",
  "typescript/agent",
  "typescript/mcp",
  "typescript/shared"
]
```

Run `yarn install` in the repository root to install dependencies for all packages.

### Package Scripts

Each package defines common scripts:

- `yarn build` – Compile TypeScript to `dist/` (where applicable).
- `yarn start` – Run the package in development mode.
- `yarn test` – Execute unit tests with Jest or React Testing Library.

The root `package.json` exposes additional helper scripts:

- `yarn start` – Start the Go backend and React frontend together using `scripts/start.js`.
- `yarn start:mcp` – Start the backend and the MCP server using `scripts/start-mcp.js`.
- `yarn test` – Run backend, frontend, agent, and MCP tests using `scripts/test-summary.js`.

## TypeScript Configuration

The file `typescript/tsconfig.json` contains base compiler options shared by all packages. Individual package `tsconfig.json` files extend it and set their own `outDir`, `rootDir`, and other settings.

Example from `typescript/ui/tsconfig.json`:

```
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "./src",
    "outDir": "./build",
    "jsx": "react-jsx"
  },
  "include": [
    "src",
    "../shared/ts",
    "src/test-utils.tsx",
    "src/setupTests.js",
    "../shared/days.ts"
  ]
}
```

## Relationships Between Modules

- The **ui** package relies on the **mcp** server for API requests and imports types from **shared**.
- The **agent** package interacts with the backend through its own workflows and also consumes **shared** utilities.
- The **mcp** package exposes REST endpoints built on top of the `@modelcontextprotocol/sdk` and coordinates with the Go backend; it reuses **shared** types for request and response definitions.

## Development Workflow

1. Install dependencies: `yarn install`.
2. Start the development environment:
   - For frontend/back­end together: `yarn dev` (defined in `scripts/dev-start.js`).
   - To run only the backend and frontend: `yarn start`.
   - To launch the MCP server with the backend: `yarn start:mcp`.
3. Run tests before committing with `yarn test`.

## Testing

- React unit tests live in `typescript/ui/src`.
- Agent tests are located in `typescript/agent/tests`.
- MCP server tests reside in `typescript/mcp/tests`.
- Execute all suites with `yarn test` at the repository root.

## Production Build

A production Dockerfile (`typescript/Dockerfile.prod`) is provided for building a containerized version of the application. It installs dependencies, builds the TypeScript packages, and serves the frontend with Nginx.

---

This README summarizes how the TypeScript packages are organized and built. See `AGENTS.md` and `CLAUDE.md` in the repository root for project-wide guidelines.
