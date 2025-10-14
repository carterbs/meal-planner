# MCP Service

TypeScript MCP server that exposes meal planner backend functionality to AI agents via HTTP transport. Implements the [Model Context Protocol specification](https://modelcontextprotocol.io/specification/2025-06-18/server) to provide resources and tools for meal planning operations.

## MCP Server Details

- **MCP SDK Version**: @modelcontextprotocol/sdk ^1.12.3
- **Server Name**: `mealplanner-mcp`
- **Server Version**: `1.0.0`
- **Transport**: HTTP with SSE streaming (`StreamableHTTPServerTransport`)
- **Session Mode**: Stateless (supports multiple concurrent agent sessions)
- **Content Types**: JSON responses with `application/json` MIME type

## Architecture

- **Transport**: HTTP with SSE streaming (`StreamableHTTPServerTransport`)
- **Port**: 3001 (configurable via `MCP_PORT`)
- **Backend**: Connects to Go backend via HTTP (`BACKEND_BASE_URL`)
- **Logging**: gRPC connection to logging service + local file backup
- **Error Handling**: Proper MCP error codes (-32000 for backend errors)
- **Retry Logic**: 30-attempt retry with 2s delays for backend connections

```
AI Agent → HTTP/SSE → MCP Server → HTTP → Go Backend
                        ↓
                gRPC Logging Service
                        ↓
                Local File Backup
```

## MCP Resources

All resources follow MCP specification with proper URI schemes and content structure:

- **MealPlan** (`meal://plan/current`) - Current weekly plan with status/version metadata and `items` containing enum-backed meal slots plus meal snapshots
- **Recipes** (`meal://recipes/all`) - All recipe summaries with metadata including ID, name, effort level, red meat status
- **RecipeSteps** (`meal://recipes/steps`) - Detailed cooking steps for specific recipes

### Meal Plan Schema Update

The MCP server now returns the gRPC-backed `MealPlan` message. Clients must read `plan.items` (array of `MealPlanItem`) instead of the legacy `plan.days` shape, and interpret meal slots via the `MealSlot` enum (`BREAKFAST`, `LUNCH`, `DINNER`). Each item carries a `meal_snapshot` payload plus plan-level `status`, `version`, and timestamp metadata for optimistic updates.

## MCP Tools

All tools use Zod schema validation and return structured JSON responses. Error handling follows MCP specification with appropriate error codes.

| Tool | Parameters | Description |
|------|------------|-------------|
| `generateMealPlan` | None | Create a fresh 7-day meal plan with automatic recipe selection based on effort preferences and red meat limits |
| `finalizeMealPlan` | `threadId: string` | Commit the current plan as final for the specified thread |
| `swapMeal` | `day: string, mealType: enum` | Replace a meal with random alternative of same type |
| `replaceMeal` | `day: string, mealType: enum, newMealId: number` | Replace specific meal with chosen recipe, considering effort levels and dietary constraints |
| `generateShoppingList` | `threadId: string` | Generate consolidated ingredient list for current meal plan |
| `createRecipe` | `name, redMeat: boolean, effort: enum, steps: array, ingredients?: array` | Add new recipe with full metadata, cooking steps, and optional ingredients |
| `deleteRecipe` | `id: number` | Permanently remove recipe from database |
| `getMeals` | `mealType?: enum` | Retrieve all available meals with metadata, optionally filtered by type |
| `getCurrentMealPlan` | None | Fetch active meal plan with all scheduled meals |
| `removeMeal` | `day: string, mealType: enum` | Remove specific meal from current plan |
| `getMealIngredients` | `mealId: number` | Fetch all ingredients for a specific meal, including quantities, units, and names |
| `addMealIngredient` | `mealId: number, ingredient: {name, quantity, unit}` | Add a new ingredient to an existing meal with specified quantity and unit |
| `updateMealIngredient` | `mealId: number, ingredientId: number, ingredient: {name?, quantity?, unit?}` | Update an existing ingredient in a meal with new quantity, unit, or name |
| `removeMealIngredient` | `mealId: number, ingredientId: number` | Remove an ingredient from a meal by ingredient ID |

### Tool Parameter Details

**Day Values**: `Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday`
**Meal Types**: `breakfast, lunch, dinner`  
**Effort Levels**: `LOW, MED, HIGH`
**Thread IDs**: Used for session management in stateless mode

## Development

**Stack**: TypeScript, Express, MCP SDK, gRPC logging

### Setup
```bash
yarn install          # Install dependencies
yarn build            # Compile TypeScript
yarn dev              # Development with hot reload
yarn test             # Run unit tests
```

### Environment Variables
- `MCP_PORT` - Server port (default: 3001)
- `BACKEND_BASE_URL` - Go backend URL (default: http://127.0.0.1:8090)
- `LOGGING_SERVICE_ADDR` - gRPC logging service (default: localhost:50052)

### MCP Endpoints
- `GET /health` - Health check (tests logging service and backend connectivity)
- `POST /mcp` - MCP protocol endpoint with SSE streaming
- `GET /mcp` - MCP protocol endpoint for capability negotiation

### Logging Architecture
- **Primary**: gRPC connection to centralized logging service
- **Retry Logic**: 30-attempt connection retry with 2s delays on startup
- **Fallback**: Local file logging to `mcp-debug.log` when gRPC unavailable
- **Format**: Structured protobuf LogEntry with timestamps, levels, and metadata
- **Levels**: DEBUG, INFO, WARN, ERROR with appropriate routing

### Testing
```bash
yarn test             # Run Jest unit tests with mocked HTTP calls
```

**Test Coverage**:
- Unit tests in `tests/` directory using Jest + nock for HTTP mocking
- Resource fetching tests with backend simulation
- Tool execution tests with error handling validation
- MCP protocol compliance testing

### MCP Development Notes

**Error Handling**: All tools and resources use proper MCP error codes:
- `-32000`: Backend/external service errors
- Proper error propagation with descriptive messages
- Graceful fallback behavior when services unavailable

**Performance**: 
- 5-second timeout on backend requests
- Automatic retry logic with exponential backoff
- Stateless server design for horizontal scaling

**Protocol Compliance**:
- Follows MCP specification for resource/tool registration
- Proper URI schemes for resources (`meal://`)
- Structured JSON responses with appropriate MIME types
- SSE streaming for real-time communication

## Docker Development
```bash
# Uses Dockerfile.dev with yarn workspaces
docker build -f Dockerfile.dev -t mcp-service .
```

## MCP Client Integration

### Connection Methods

**HTTP/SSE Transport**:
```typescript
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const transport = new StreamableHTTPClientTransport({
  baseUrl: 'http://localhost:3001/mcp'
});
```

**Server Capabilities**: The server advertises these MCP capabilities:
- Resources: 3 available (MealPlan, Recipes, RecipeSteps)
- Tools: 10 available (meal planning, recipe management, shopping lists)
- Sampling: Not supported
- Logging: Structured logging via gRPC with local fallback

### Example MCP Client Usage

```typescript
// List available resources
const resources = await client.listResources();

// Read a specific resource
const mealPlan = await client.readResource('meal://plan/weekly');

// Execute a tool
const result = await client.callTool('generateMealPlan', {});
```

The server runs in **stateless mode**, supporting multiple concurrent agent sessions without session conflicts.

## Debugging & Troubleshooting

### MCP Server Health Check
```bash
curl http://localhost:3001/health
```
Expected response: `{"status":"ok","service":"mealplanner-mcp","message":"All dependencies healthy"}`

### Common Issues

**Connection Failures**:
- Check that `BACKEND_BASE_URL` points to running Go backend 
- Verify gRPC logging service is available at `LOGGING_SERVICE_ADDR`
- Review `mcp-debug.log` for detailed error traces

**MCP Protocol Errors**:
- Ensure client uses proper SSE streaming transport
- Verify JSON-RPC message format compliance
- Check MCP SDK version compatibility (@modelcontextprotocol/sdk ^1.12.3)

**Resource/Tool Errors**:
- Backend connectivity issues return MCP error code -32000
- Invalid parameters trigger Zod validation errors
- Check server logs for detailed error context

### Development Debugging

**Log Levels**: 
- Use `debugLog()` for detailed tracing
- `infoLog()` for operational events  
- `errorLog()` for failures requiring attention

**Manual Testing**:
```bash
# Test MCP endpoint directly
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Performance Monitoring

- **Backend Latency**: Monitor response times to Go backend API
- **gRPC Logging**: Check connection retry patterns and success rates  
- **Memory Usage**: Track JSON parsing/serialization overhead
- **Concurrent Sessions**: Validate stateless operation under load
