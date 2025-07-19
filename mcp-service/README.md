# Model Context Protocol (MCP) Server

This directory contains the TypeScript implementation of the Model Context Protocol (MCP) server for the meal planning application. The MCP layer exposes backend data and functionality in a format that AI agents can easily consume while maintaining a clean separation between LLM interactions and application logic.

## Architecture

The server is built with [`@modelcontextprotocol/sdk`](https://modelcontextprotocol.io) and runs as a Node.js process. `src/index.ts` creates an `McpServer` instance and registers all resources and tools. The server communicates over standard input/output using `StdioServerTransport` and connects to the Go backend via HTTP.

```
AI Client/Agent ↔ MCP Server ↔ Meal Planner Backend
```

The backend base URL is controlled by the `BACKEND_BASE_URL` environment variable (defaults to `http://localhost:8080`). Logging is handled by `src/utils/logger.ts` which writes timestamps to `logs/mcp-server.log`.

### Resources

Resources provide contextual documents to the LLM. The server exposes:

- **WeeklyMealPlan** (`meal://plan/weekly`) – current weekly plan with meal names and dates.
- **Recipes** (`meal://recipes/all`) – list of all recipe summaries.
- **RecipeSteps** (`meal://recipes/steps`) – detailed steps for a specific recipe.

### Tools

Tools allow the agent to invoke backend actions. Each tool wraps a REST endpoint:

| Tool | Endpoint | Description |
|------|----------|-------------|
| `generateMealPlan` | `POST /api/mealplan/generate` | Create a fresh weekly plan. |
| `finalizeMealPlan` | `POST /api/mealplan/finalize` | Commit the current plan as final. |
| `swapMeal` | `POST /api/meals/swap` | Replace a meal on a day with a random alternative. |
| `replaceMeal` | `POST /api/mealplan/replace` | Replace a specific meal with a chosen one. |
| `generateShoppingList` | `POST /api/shoppinglist` | Return a list of ingredients for a plan. |
| `createRecipe` | `POST /api/meals` | Add a new recipe to the database. |
| `deleteRecipe` | `DELETE /api/meals/{id}` | Remove a recipe permanently. |
| `getMeals` | `GET /api/meals` | Retrieve meals, optionally filtered by type. |
| `getCurrentMealPlan` | `GET /api/mealplan` | Fetch the active meal plan. |
| `removeMeal` | `POST /api/meals/remove` | Remove a meal from the current plan. |

### Protocol Flow

1. An AI agent starts the MCP server (usually via `scripts/start-mcp.js`).
2. The agent connects using `StdioClientTransport` from the MCP SDK.
3. The client requests resources or calls tools. The server forwards those requests to the backend and returns structured MCP responses.
4. All messages follow the [Model Context Protocol](https://modelcontextprotocol.io) specification, enabling safe tool execution and resource delivery.

### Authentication & Security

The development setup runs without authentication. In production you can place the MCP server behind an authenticating proxy or extend it to require API keys when calling tools. CORS headers are enabled in the Go backend for local development.

## Development

Install dependencies with `yarn` (already provided). Useful commands inside `mcp-service`:

- `yarn build` – compile TypeScript to `dist/`.
- `yarn start` – run the compiled server.
- `yarn dev` – start with automatic reload using `nodemon` and `tsx`.
- `yarn test` – run unit tests for resources and tools.

From the repository root, `yarn test` runs all project suites including MCP tests.

### Debugging

`scripts/start-mcp.js` launches the backend, builds the MCP server, and writes console logs to `logs/mcp-console.log`. Inspect this log for runtime errors. The server itself logs to `logs/mcp-server.log`.

## Deployment & Operations

1. Run `yarn build` to produce `dist/index.js`.
2. Start the backend (e.g., `go run main.go --dummy` or via Docker).
3. Launch the MCP server with `node dist/index.js` or use the helper script `scripts/start-mcp.js`.
4. Monitor the logs in `mcp-service/logs/` for health.

The server is stateless aside from logs and connects to the backend via HTTP, so it can be scaled horizontally behind a process manager.

## Configuration

- `BACKEND_BASE_URL` – base URL for the Go backend (default `http://localhost:8080`).

## Integration with AI Agents

The `MealPlanningWorkflow` in `agent-service/workflows/meal-planning.ts` initializes a client:

```ts
const client = new Client({ name: 'meal-planner-workflow', version: '1.0.0' });
const transport = new StdioClientTransport({ command: 'node', args: ['scripts/start-mcp.js'] });
await client.connect(transport);
```

Once connected, the workflow can call MCP tools using `callMCPTool` from `agent-service/shared/mcp-types.ts` to generate plans, modify meals, and produce shopping lists.

## Testing Strategy

Unit tests live in `tests/` and mock fetch calls to validate each tool and resource. Run `yarn test` in this directory to execute the suite. Always run `yarn test` from the repository root before committing changes to ensure all modules continue to pass.

## Customization

You can extend the server by registering additional resources or tools in `src/index.ts`. Follow the patterns in the existing files and consult the MCP SDK documentation for advanced features such as custom transports or proxying authorization requests.

