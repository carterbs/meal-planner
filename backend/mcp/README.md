# Meal Planner MCP Server

This directory contains the Model Context Protocol (MCP) server exposing the meal planner backend.

## Quick start

```bash
cd backend/mcp
yarn build
NODE_ENV=production BACKEND_BASE_URL=http://localhost:8080 node dist/index.js
```

The server listens on `MCP_PORT` (default `3001`).

## Environment variables

| Name | Default | Purpose |
|------|---------|---------|
| `BACKEND_BASE_URL` | `http://localhost:8080` | Go API root |
| `MCP_PORT` | `3001` | HTTP/SSE listen port |

## Resources
- **WeeklyMealPlan** – `GET /api/mealplan`
- **Recipes** – `GET /api/meals`
- **RecipeSteps** – `GET /api/meals/{id}/steps`

## Tools
- `generateMealPlan`
- `finalizeMealPlan`
- `swapMeal`
- `replaceMeal`
- `generateShoppingList`
- `createRecipe`
- `deleteRecipe`

## Error codes
- `-32000` – BackendError
- `-32602` – Invalid params
- `-32603` – Internal error
