# AGENTS Instructions for Meal Planner

This repository contains a Go backend and a React/TypeScript frontend for a personal meal planning application. All dependencies should be pre-installed and ready to go.

## Repository layout
- `backend/` – Go API server and database migrations
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

