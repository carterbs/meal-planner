import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { MCP_PORT } from './utils.js';
import { registerWeeklyMealPlan } from './resources/weeklyMealPlan.js';
import { registerRecipes } from './resources/recipes.js';
import { registerRecipeSteps } from './resources/recipeSteps.js';
import { registerGenerateMealPlan } from './tools/generateMealPlan.js';
import { registerFinalizeMealPlan } from './tools/finalizeMealPlan.js';
import { registerSwapMeal } from './tools/swapMeal.js';
import { registerReplaceMeal } from './tools/replaceMeal.js';
import { registerGenerateShoppingList } from './tools/generateShoppingList.js';
import { registerCreateRecipe } from './tools/createRecipe.js';
import { registerDeleteRecipe } from './tools/deleteRecipe.js';

const app = express();
app.use(cors());
app.use(express.json());

const server = new McpServer({ name: 'mealplanner-mcp', version: '1.0.0' });

registerWeeklyMealPlan(server);
registerRecipes(server);
registerRecipeSteps(server);

registerGenerateMealPlan(server);
registerFinalizeMealPlan(server);
registerSwapMeal(server);
registerReplaceMeal(server);
registerGenerateShoppingList(server);
registerCreateRecipe(server);
registerDeleteRecipe(server);

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

const transports: Record<string, SSEServerTransport> = {};

app.get('/sse', async (req, res) => {
  const transport = new SSEServerTransport('/messages', res);
  transports[transport.sessionId] = transport;
  transport.onclose = () => { delete transports[transport.sessionId]; };
  await server.connect(transport);
});

app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];
  if (!transport) {
    res.status(404).send('Session not found');
    return;
  }
  await transport.handlePostMessage(req, res, req.body);
});

app.listen(MCP_PORT, () => {
  console.error(`MealPlanner MCP server running on http://localhost:${MCP_PORT}`);
});
