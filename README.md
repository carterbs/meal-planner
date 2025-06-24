# Meal Planner

A full-stack meal planning app with a Go backend, React TypeScript frontend, and a small MCP server for LLM integration. Use it to generate weekly meal plans, manage recipes and export shopping lists.

## Repository structure

- **backend/** – Go API server and database migrations
- **backend/mcp/** – TypeScript server exposing backend tools via Model Context Protocol
- **frontend/** – React app
- **agent/** – Node based LLM agent used in development experiments
- **scripts/** – Dev scripts for starting servers and managing the database
- **docs/** – Additional project documentation
- **db-backups/** – PostgreSQL dumps created by `yarn db:backup`
- **docker-compose.yml** – Local Postgres + pgAdmin services

See [`docs/MealPlannerSummary.md`](docs/MealPlannerSummary.md) for a deeper technical overview.

## Technology stack

- Go 1.20 backend using chi router and PostgreSQL
- React 18 + TypeScript with Material UI
- Yarn workspaces manage frontend, backend/mcp and agent packages
- Jest and React Testing Library for frontend tests
- Go's testing tools with sqlmock for backend tests

## Data flow

1. The React app (in `frontend/`) calls REST endpoints (see `backend/handlers/`) via the proxy in `frontend/package.json`.
2. Handlers invoke business logic in `backend/models/` which query PostgreSQL (or dummy data if the backend is started with `--dummy`).
3. Responses are returned to the frontend where components update local state.
4. The MCP server (`backend/mcp/`) exposes selected backend operations over stdio for LLM tools.

Important frontend helpers live in `frontend/src/test-utils.tsx`. Backend Makefile targets (`backend/Makefile`) provide coverage tools.

## Getting started

```bash
# start Postgres
docker-compose up -d

# install dependencies
yarn

# run backend with dummy data
cd backend && go run main.go --dummy

# in another terminal run the frontend
cd ../frontend && yarn start
```

`yarn start` from the repo root runs both servers for convenience.

## Testing

Run all tests from the repository root:

```bash
yarn test
```

Individual suites:

```bash
yarn test:backend   # Go tests
yarn test:frontend  # React tests
```

## Known issues

- The backend requires database credentials via environment variables unless run with `--dummy`.
- The root `yarn start` script kills processes on ports 8000 and 5000 which can terminate unrelated services.

## Further reading

- `frontend/style-guide.md` – UI color palette and layout notes
- `frontend/TEST-IMPROVEMENTS.md` – test strategy
- `agent/AGENTS.md` – running the sample LLM agent (`yarn dev:codex`)

