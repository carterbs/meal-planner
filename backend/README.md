# Go Backend

This directory contains the server side of the Meal Planner application. It exposes a REST API that powers the React/TypeScript frontend and coordinates with the TypeScript agent workflow.

## Architecture Overview

The backend is a Go application organized into the following packages:

- **`main.go`** – entry point. Handles configuration, database connection, middleware and router setup.
- **`handlers/`** – HTTP handlers grouped by feature (`mealplan`, `meals`, `steps`, `agent`, `workflows`). Each file registers endpoints and contains request/response logic.
- **`models/`** – data models and business logic. This layer contains database queries, meal plan generation algorithms, workflow state helpers and migration utilities.
- **`db/`** – helpers for connecting to PostgreSQL with environment-driven configuration.
- **`dummy/`** – in-memory data implementation used when the server is started with `--dummy`.
- **`migrations/`** – SQL migration files applied automatically on startup when a real database is available.

The application uses the [chi](https://github.com/go-chi/chi) router. Middleware includes request logging, panic recovery, request timeouts and a custom `DBErrorMiddleware` which returns helpful messages when the database is unreachable. CORS headers are added in development mode.

### Routing & Endpoints

Routes are registered in `main.go`. Key endpoint groups include:

- **Health & Reconnect** – `/api/health` and `/api/reconnect` to verify and re-establish database connectivity.
- **Meal Plan** – `/api/mealplan` endpoints to retrieve, generate and finalize weekly plans. `/api/mealplan/ics` exports a plan as an iCalendar file.
- **Meals** – `/api/meals` for CRUD operations, meal swapping and ingredient management.
- **Recipe Steps** – `/api/meals/{mealId}/steps` to manage instructions for a meal.
- **Shopping List** – `/api/shoppinglist` generates a consolidated list of ingredients for a plan.
- **Agent Workflows** – `/api/agent` routes call the TypeScript agent CLI to run or resume automated planning workflows.
- **Workflow State** – `/api/workflows` endpoints store and retrieve workflow progress using the `workflow_checkpoints` table.

See the table below for a detailed list of HTTP methods and paths.

### Database Design

PostgreSQL stores meal and workflow data. The main tables are:

- `meals` – meal metadata (`meal_name`, `relative_effort`, `meal_type`, `red_meat`, `url`, `last_planned`).
- `ingredients` – ingredients linked to `meals`.
- `recipe_steps` – ordered instructions for each meal.
- `workflow_checkpoints` – JSON blobs used to persist workflow state between agent runs.

Tables for agent sessions are being removed and are omitted here. All migrations live in `backend/migrations` and run automatically at startup through `models.Migrate()`.

### Models and Business Logic

The `models` package exposes functions used by handlers:

- **Meal plan generation** – `GenerateWeeklyMealPlan` creates a balanced week of breakfasts, lunches and dinners while rotating red meat usage. `GetLastPlannedMeals` reconstructs the previous plan when available.
- **Meal management** – `CreateMeal`, `DeleteMeal`, `GetMealsByIDs`, `GetAllMeals`, ingredient updates and step management functions.
- **Shopping lists** – utilities aggregate ingredients across meals into easy to read lists.
- **Workflow helpers** – save and retrieve workflow checkpoints and message history. These interact with the `workflow_checkpoints` table.

### Features

- **Recipe management** – CRUD endpoints for meals, ingredients and detailed recipe steps.
- **Meal planning** – automatic weekly plan generation with ability to swap or remove meals and finalize a plan to update `last_planned` dates.
- **Shopping list creation** – generate aggregated lists from any plan or set of meals.
- **Agent integration** – the server runs the Node based agent CLI to provide conversational planning workflows. Workflow progress and messages are persisted so sessions can be resumed.

### Development Workflow

1. Install dependencies via `yarn` (already provided).
2. Start the backend in dummy mode:
   ```bash
   cd backend && go run main.go --dummy
   ```
   This loads in-memory data and does not require PostgreSQL.
3. For a full environment, run `docker-compose up` to start PostgreSQL then launch the server without `--dummy`.
4. Frontend development is run from `typescript/ui` with `yarn start`.

### Testing

Run all tests from the repository root:

```bash
yarn test
```

This executes Go unit tests (`make test` under `backend`), frontend tests and agent tests, then prints a summary.

### Build & Deployment

- The `Dockerfile.prod` builds the Go binary for production use.
- The Makefile provides coverage helpers (`make coverage`, `make coverage-html`).
- On startup with a real database, migrations are applied automatically and the server listens on `:8080`.
- Logging uses Go's standard `log` package; monitoring or advanced metrics can be integrated as needed.

### API Reference

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/health` | Database health check |
| POST | `/api/reconnect` | Attempt to reconnect to the database |
| GET | `/api/mealplan` | Retrieve the last meal plan or generate a new one |
| POST | `/api/mealplan/generate` | Force generation of a new meal plan |
| POST | `/api/mealplan/finalize` | Mark plan meals as planned (updates dates) |
| GET | `/api/mealplan/ics` | Download current plan as an iCalendar file |
| POST | `/api/shoppinglist` | Build a shopping list from meal IDs |
| GET | `/api/meals` | List all meals (optional `type` filter) |
| POST | `/api/meals` | Create a new meal with ingredients and steps |
| DELETE | `/api/meals/{mealId}` | Delete a meal and its ingredients |
| POST | `/api/meals/swap` | Return a random meal to swap in |
| POST | `/api/meals/remove` | Remove a meal from a workflow plan |
| POST | `/api/meals/replace` | Fetch a specific meal by ID |
| PUT | `/api/meals/{mealId}/ingredients/{ingredientId}` | Update an ingredient |
| DELETE | `/api/meals/{mealId}/ingredients/{ingredientId}` | Delete an ingredient |
| GET | `/api/meals/{mealId}/steps` | List recipe steps |
| POST | `/api/meals/{mealId}/steps` | Add a single step |
| POST | `/api/meals/{mealId}/steps/bulk` | Add steps from text or array |
| PUT | `/api/meals/{mealId}/steps/{stepId}` | Update a step |
| DELETE | `/api/meals/{mealId}/steps/{stepId}` | Delete a step |
| PUT | `/api/meals/{mealId}/steps/reorder` | Reorder steps |
| DELETE | `/api/meals/{mealId}/steps` | Delete all steps for a meal |
| POST | `/api/agent/start` | Start a new agent workflow |
| POST | `/api/agent/message` | Send a message and resume the workflow |
| GET | `/api/agent/status/{threadId}` | Get agent workflow status |
| GET | `/api/agent/workflows` | List running workflows |
| DELETE | `/api/agent/workflows/{threadId}` | Cancel a workflow |
| GET | `/api/workflows/{threadId}` | Retrieve complete workflow state |
| POST | `/api/workflows/{threadId}/abandon` | Mark a workflow as abandoned |
| POST | `/api/workflows/{threadId}/messages` | Add a chat message to history |
| PUT | `/api/workflows/{threadId}/state` | Update persisted session fields |

---

This README provides an overview of the Go backend. Refer to comments in the source code for additional implementation details.

