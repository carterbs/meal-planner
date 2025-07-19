# Scripts Directory

This folder contains all automation and helper scripts used to develop, test and maintain the Meal Planner application.  Most scripts are invoked via [`yarn`](../package.json) commands defined at the repository root.

## Table of Contents

1. [Development Scripts](#development-scripts)
2. [Testing Utilities](#testing-utilities)
3. [Database Management](#database-management)
4. [Agent CLI](#agent-cli)
5. [End-to-End Utilities](#end-to-end-utilities)
6. [Workflow Integration](#workflow-integration)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Development Scripts

### `dev-start.js`
Starts the entire development environment. The script ensures Docker is running and will start `docker-compose` services if necessary. After verifying the PostgreSQL container is ready it launches both the backend and frontend. Use via:

```bash
yarn dev
```

This command is convenient when you want to spin up everything for local development. It automatically handles container start up and waits for the database before launching the application.

### `start.js`
Launches the Go backend followed by the React frontend, killing any processes already listening on ports 8000 or 5000. This is the default command behind:

```bash
yarn start
```

Use this script when containers are already running or when deploying without the MCP server.

### `start-mcp.js`
Starts the backend and the TypeScript MCP server. It also ensures the database container is running and will build the MCP server before launching. Ports 8080 and 3001 are freed before start. Invoked with:

```bash
yarn start:mcp [--codex]
```

The optional `--codex` flag passes the `--dummy` argument to the backend which allows running without modifying a real database.

### `kill-servers.js`
Utility to kill any stray backend, MCP or frontend processes listening on common ports (8000, 8080, 5000, 3001, 3000). Run directly or via:

```bash
yarn kill:servers
```

### `meal-agent.sh`
Convenience wrapper for the meal planning agent CLI. It verifies the agent is built and runs the CLI with any provided arguments:

```bash
./scripts/meal-agent.sh [args]
```

## Testing Utilities

### `test-summary.js`
Aggregates results from backend, frontend and agent tests into a single summary. This script powers `yarn test` and is executed before every commit. It calls the following underlying commands:

- `yarn test:backend`
- `yarn test:frontend`
- `yarn test:agent`

### End-to-End Scripts
Several bash scripts provide targeted end‑to‑end flows used during development:

- `e2e_backend_meal_removal.sh`
- `e2e_backend_meal_replacement.sh`
- `e2e_new_session_shopping_list.sh`
- `e2e_remove_friday.sh`
- `e2e_remove_saturday.sh`

These scripts start the backend, perform specific workflow actions (such as removing meals or generating shopping lists) and validate the results using `curl` and `jq`. They are intended for manual execution when verifying complex scenarios.

## Database Management

### `backup-db.js`
Creates timestamped PostgreSQL backups from the running `meal-planner_db_1` container and retains only the most recent backups. Accessible through:

```bash
yarn db:backup
```

### `restore-db.js`
Restores a backup created by `backup-db.js`. When executed without arguments it lists available backups and prompts for a selection. Run with:

```bash
yarn db:restore [backup-file]
```

## Agent CLI
The meal planning agent found in `agent-service` can be executed via the `meal-agent.sh` wrapper mentioned above or directly with `node`. It relies on environment variables or an `.env` file for database access. Build the agent using:

```bash
yarn build:agent
```

## End-to-End Utilities
See the [End-to-End Scripts](#end-to-end-scripts) section above. They demonstrate how to automate complex user scenarios and can serve as templates for new flows.

## Workflow Integration

- **Local development**: `yarn dev` brings up Docker services and both apps. Use `yarn kill:servers` if ports become stuck.
- **Testing**: `yarn test` runs `test-summary.js`, providing one report across all packages. Continuous integration should invoke this command.
- **Database**: Back up your local database with `yarn db:backup` before experiments and restore with `yarn db:restore` when needed.
- **Deployment/MCP**: `yarn start:mcp` starts the backend and MCP gateway for the production-like environment.

## Best Practices

- Always run `yarn test` before committing changes.
- Use `yarn dev` during everyday development to ensure Docker containers start correctly and the database is ready.
- Clean up stray processes with `yarn kill:servers` if ports are in use or scripts fail unexpectedly.
- Keep regular backups of your local database using `yarn db:backup`.
- Maintain each script by keeping dependencies in `package.json` up to date and reviewing for environment changes (e.g., container names).

## Troubleshooting

- **Ports already in use**: Run `yarn kill:servers` to terminate lingering processes.
- **Docker errors on `yarn dev`**: Try `docker-compose down` and rerun the command. Ensure Docker Desktop is running.
- **Database restore fails**: Verify the container name in `restore-db.js` matches your `docker-compose` service. Use `docker ps` to confirm.
- **Tests fail to start**: Run underlying suites individually (`yarn test:backend`, `yarn test:frontend`, `yarn test:agent`) to pinpoint issues.

This documentation should help both new and experienced developers leverage the automation scripts that power the Meal Planner project.
