# Meal Planner Go Backend

This directory contains the Go implementation of the meal planning server. It provides a REST API for the React frontend and agent workflows. The service can run against a PostgreSQL database or operate completely in-memory using the `--dummy` flag.

## Architecture Overview

```
backend/
├── db/         # Database connection helpers
├── dummy/      # In-memory data implementation used in dummy mode
├── handlers/   # HTTP handlers for all API endpoints
├── migrations/ # SQL migrations applied at startup
├── models/     # Data models and business logic
├── main.go     # Application entry point
└── Makefile    # Test and coverage helpers
```

### Application Entry
The server is started by running `go run main.go`. Two flags modify its behaviour:

- `--seed` &ndash; Seed the database from `Meal_db.csv` if provided.
- `--dummy` &ndash; Use in-memory data structures instead of connecting to PostgreSQL.

Environment variables configure the database connection (see `.env.example`). When `--dummy` is supplied, all data is loaded from the CSV file and persisted only in memory.

### Routing and Middleware
[`main.go`](./main.go) configures the HTTP router using [Chi](https://github.com/go-chi/chi). Common middleware such as logging, recovery and request timeouts are enabled. `DBErrorMiddleware` returns a helpful JSON error when the database cannot be reached.

```
GET  /api/health              # basic health check
POST /api/reconnect           # attempt to reconnect to the DB
```

The remainder of the API is served under `/api/*` and handled in the `handlers` package.

## Database and Models

PostgreSQL is used for persistence. Migrations live in `backend/migrations` and are executed automatically on startup. The schema contains tables for meals, ingredients, recipe steps and workflow checkpoints. Models in `backend/models` implement all data access and business logic.

Key models include:

- **Meal** – main recipe record with ingredients and optional steps.
- **WeeklyMealPlan** – array-based representation of a week's meals.
- **ShoppingListItem** – aggregated items derived from meals.
- **WorkflowState** – persisted state for agent driven workflows.

`models/migrate.go` contains the logic to create the required tables if they do not already exist.

## REST API

The handlers expose a JSON REST API used by the frontend and other services. Important endpoints include:

### Meal Plans
- `GET  /api/mealplan` – Retrieve the most recent meal plan or generate a new one.
- `POST /api/mealplan/generate` – Force creation of a new weekly plan.
- `POST /api/mealplan/finalize` – Mark meals in a plan as planned.
- `GET  /api/mealplan/ics` – Download the plan as an iCalendar file.
- `POST /api/mealplan/replace` – Replace a meal in the current plan.
- `POST /api/shoppinglist` – Return a combined shopping list for a list of meal IDs.

### Meals and Recipes
- `GET    /api/meals` – List meals, optionally filtered by type.
- `POST   /api/meals` – Create a new meal with ingredients.
- `DELETE /api/meals/{mealId}` – Delete a meal.
- `POST   /api/meals/swap` – Get a replacement meal of the same type.
- `POST   /api/meals/remove` – Remove a meal from a plan.
- `PUT    /api/meals/{mealId}/ingredients/{ingredientId}` – Update an ingredient.
- `DELETE /api/meals/{mealId}/ingredients/{ingredientId}` – Delete an ingredient.
- `GET    /api/meals/{mealId}/steps` – Retrieve recipe steps.
- `POST   /api/meals/{mealId}/steps` – Add a single step.
- `POST   /api/meals/{mealId}/steps/bulk` – Add multiple steps from text or JSON.
- `PUT    /api/meals/{mealId}/steps/{stepId}` – Update a step.
- `DELETE /api/meals/{mealId}/steps/{stepId}` – Delete a step.
- `PUT    /api/meals/{mealId}/steps/reorder` – Reorder steps for a meal.
- `DELETE /api/meals/{mealId}/steps` – Remove all steps for a meal.

### Agent Workflows
The backend proxies long‑running meal planning workflows implemented in the Node agent. Endpoints include:

- `POST /api/agent/start` – Start a new workflow.
- `POST /api/agent/message` – Send a message and resume the workflow.
- `GET  /api/agent/status/{threadId}` – Check workflow status.
- `GET  /api/agent/workflows` – List workflows.
- `DELETE /api/agent/workflows/{threadId}` – Cancel a workflow.

Workflow state and history can be managed via:

- `GET  /api/workflows/{threadId}` – Fetch full state for a workflow.
- `POST /api/workflows/{threadId}/abandon` – Mark a workflow as abandoned.
- `POST /api/workflows/{threadId}/messages` – Persist a chat message.
- `PUT  /api/workflows/{threadId}/state` – Update stored workflow data.

## Features

- **Meal plan generation** with dietary rotation (e.g. limited red meat).
- **Recipe management** including ingredients and step‐by‐step instructions.
- **Shopping list creation** from a set of meals.
- **Agent driven workflows** which store progress in the `workflow_checkpoints` table.
- Support for an in‑memory **dummy mode** to simplify local development.

## Development

Start the backend with dummy data:

```bash
cd backend
go run main.go --dummy
```

Run the React frontend from `typescript/ui` with:

```bash
cd typescript/ui
yarn start
```

### Testing
Unit tests for the Go code live alongside their packages. Execute all tests from the repository root:

```bash
yarn test
```

The Makefile in `backend/` also provides `make test` and coverage commands.

### Building & Deployment
A production Dockerfile (`Dockerfile.prod`) is provided. Database migrations run automatically on start‑up. Deployments should supply the necessary environment variables for database access.

### Monitoring & Logging
Standard library logging is used throughout the backend. Middleware ensures requests are logged and unexpected panics are recovered. Health endpoints and database reconnection helpers simplify runtime monitoring.

---
This README aims to document the Go backend in detail so new contributors can understand the overall architecture, API surface and development workflow.
