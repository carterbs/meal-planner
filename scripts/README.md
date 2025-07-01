# Scripts Directory Guide

This directory contains automation and helper scripts used throughout the Meal Planner project. They are invoked through `yarn` commands or can be run directly from the repository root. The scripts are grouped below by their main purpose along with common usage patterns and notes on how they integrate with the overall workflow.

## Development Utilities

### `dev-start.js`
Starts the full development environment. It ensures Docker is running, launches the containers defined in `docker-compose.yml`, waits for the PostgreSQL service to become reachable and then delegates to `start.js` to run the application servers.

Run with:
```bash
yarn dev
```
If the database fails to start, running `docker-compose down` and then `yarn dev` again often resolves the issue.

### `start.js`
Boots the Go backend and the React frontend. Any processes already listening on ports 8000 (backend) or 5000 are terminated first.

Run with:
```bash
yarn start
```
Use `yarn kill:servers` beforehand if ports are stuck.

### `start-mcp.js`
Starts the backend together with the TypeScript MCP server. It kills processes on ports 8080 and 3001, starts the Docker database container, builds the MCP server, then launches both services. MCP server logs are written to `typescript/mcp/logs/mcp-console.log`.

Run with:
```bash
yarn start:mcp [--codex]
```
Pass `--codex` to start the backend in dummy mode as used by automated agents.

### `kill-servers.js`
Utility to terminate leftover server processes occupying common ports (8000, 8080, 5000, 3001, 3000). Safe to run multiple times.

Run with:
```bash
yarn kill:servers
```

### `meal-agent.sh`
Wrapper for the command‑line meal planning agent. Builds the agent if necessary and forwards all arguments to the CLI.

Run with:
```bash
./scripts/meal-agent.sh [args]
```
Ensure any required environment variables or `.env` file are present in `typescript/agent`.

## Database Management

### `backup-db.js`
Creates a PostgreSQL backup from the running Docker container (`meal-planner_db_1`) and stores it under `db-backups/`. The latest seven backups are kept.

Run with:
```bash
yarn db:backup
```

### `restore-db.js`
Restores the database from a backup file. If no file is specified, a list of available backups is presented for interactive selection. The script targets the container `meal-planner-db-1`.

Run with:
```bash
yarn db:restore [backup-file.sql]
```

## Testing Scripts

### `test-summary.js`
Runs backend, frontend and agent tests in sequence and prints a concise summary. This is executed by the root `yarn test` command and should be used before every commit.

Run with:
```bash
yarn test
```

### End‑to‑End Scripts
The following shell scripts spin up a temporary backend and exercise specific workflows using `curl` and `jq`:

- `e2e_backend_meal_removal.sh` – verifies removing meals via the API.
- `e2e_backend_meal_replacement.sh` – checks swap and replace operations.
- `e2e_new_session_shopping_list.sh` – starts a session and generates a shopping list.
- `e2e_remove_friday.sh` and `e2e_remove_saturday.sh` – remove meals for the specified days.

Run them individually from the project root, e.g.:
```bash
./scripts/e2e_new_session_shopping_list.sh
```
These scripts assume `jq` and `curl` are installed and use port 8080 for the backend.

## Workflow Integration

Development typically uses the following cycle:
1. `yarn dev` to start Docker containers and both servers.
2. Make code changes.
3. `yarn test` to run all tests using `test-summary.js`.
4. Optionally run one of the E2E scripts for manual validation.
5. `yarn db:backup` before large changes or experiments.

`yarn start:mcp` is used when working on the MCP server. For a clean slate, run `yarn kill:servers` and then start the desired environment.

## Troubleshooting
- **Port already in use** – run `yarn kill:servers` to terminate lingering processes.
- **Database not responding** – run `docker-compose down` then `yarn dev` to recreate containers.
- **MCP server issues** – check `typescript/mcp/logs/mcp-console.log` for errors.
- **Backup/restore failures** – verify the Docker container names in the scripts match your environment.

## Maintenance Tips
- Keep this directory in version control so updates to script behaviour are shared.
- Review the comments inside each script for additional details or configurable values.
- Most scripts expect to be executed from the repository root.

These automation tools aim to streamline development and testing for all contributors. When in doubt, run `yarn test` and consult this document for guidance.
