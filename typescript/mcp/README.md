# MCP Server

This directory contains the Model Context Protocol (MCP) server used by the Meal Planner application.
It exposes data and functionality to AI agents through the MCP standard.

## Architecture

The server is implemented in TypeScript using the [`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk) package.  `src/index.ts` creates an `McpServer` and registers resources and tools before connecting via a `StdioServerTransport`:

```ts
const server = new McpServer({ name: 'mealplanner-mcp', version: '1.0.0' });
...
const transport = new StdioServerTransport();
await server.connect(transport);
```

The transport uses JSON-RPC messages over standard input/output allowing the server to be spawned as a child process.  `BACKEND_BASE_URL` in `src/utils.ts` defines where REST requests are sent:

```ts
export const API = process.env.BACKEND_BASE_URL || 'http://localhost:8080';
```

A logger (`src/utils/logger.ts`) redirects all console output to `logs/mcp-server.log` while still printing to the console.

## Resources

Resources supply read‑only data to clients.  They proxy requests to the backend API and return JSON payloads:

- **WeeklyMealPlan** – `meal://plan/weekly` → `/api/mealplan`
- **Recipes** – `meal://recipes/all` → `/api/meals`
- **RecipeSteps** – `meal://recipes/steps` → `/api/meals/{id}/steps`

Each resource is registered in `src/index.ts` using helper functions found in `src/resources/`.

## Tools

Tools perform actions or generate data.  The Meal Planner MCP server exposes the following tools:

| Tool | Purpose |
| ---- | ------- |
| `generateMealPlan` | Create a new weekly meal plan |
| `finalizeMealPlan` | Commit the generated plan |
| `swapMeal` | Randomly swap a meal on a given day |
| `replaceMeal` | Replace a specific meal with a chosen recipe |
| `generateShoppingList` | Produce a shopping list for a plan |
| `createRecipe` | Add a new recipe with steps and ingredients |
| `deleteRecipe` | Remove a recipe by ID |
| `getMeals` | List all meals (optionally filtered by type) |
| `getCurrentMealPlan` | Retrieve the currently active plan |
| `removeMeal` | Remove a meal from a plan session |

Each tool validates its arguments with `zod` and communicates with the backend via REST endpoints.  For example, `swapMeal` posts to `/api/meals/swap`:

```ts
export const swapArgs = z.object({
  dayIndex: z.number().int().min(0).max(6)
});
...
const resp = await fetch(`${API}/api/meals/swap`, { method: 'POST', ... });
```

## Integration with Agents and Clients

AI workflows in `typescript/agent` spawn the MCP server using the script `scripts/start-mcp.js`.  The agent connects with `StdioClientTransport` and invokes tools via the MCP client SDK.  The server can also be run directly with `yarn start:mcp` which builds the project and starts both the backend and MCP server.

Clients interact with the MCP server by sending JSON‑RPC messages over the chosen transport.  Tool results contain textual JSON which clients parse into the shared types defined in `typescript/shared`.

Currently the MCP server does not enforce authentication.  Access control should be implemented at the backend API layer or by running the server in a trusted environment.

## Development

Install dependencies once using `yarn`.  Useful commands from within `typescript/mcp`:

```bash
# Start in watch mode
yarn dev

# Build to ./dist
yarn build

# Run tests
yarn test
```

From the repository root, `yarn start:mcp` starts the backend and launches the MCP server.

### Testing & Debugging

Unit tests live in `tests/` and use Jest with `nock` for HTTP mocking.  Run all project tests from the repo root:

```bash
yarn test
```

Log output can be inspected in `logs/mcp-server.log`.  When debugging interactions with agents, run the workflow with the `--codex` flag to use a fake LLM and observe MCP requests and responses in the console.

### Deployment & Operations

The server compiles to `dist/` and can run with Node.js (`node dist/index.js`).  It communicates with the backend API whose base URL is controlled by the `BACKEND_BASE_URL` environment variable.  For production deployments you may choose the [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http) instead of stdio to host the server behind HTTPS.

Monitoring can be implemented by tailing the log file or forwarding logs to your preferred system.  Customize tools or resources by editing the files under `src/tools` and `src/resources` and rebuilding the project.

