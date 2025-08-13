import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { initLogging, infoLog, errorLog } from './logging.js';
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
import { registerGetMeals } from './tools/getMeals.js';
import { registerGetCurrentMealPlan } from './tools/getCurrentMealPlan.js';
import { registerRemoveMeal } from './tools/removeMeal.js';
import express from 'express';
import cors from 'cors';
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
registerGetMeals(server);
registerGetCurrentMealPlan(server);
registerRemoveMeal(server);
async function main() {
    try {
        await initLogging('mcp-server');
        await infoLog('MCP server starting up');
    }
    catch (error) {
        await errorLog('Failed to initialize logging: ' + String(error));
    }
    const port = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT) : 3001;
    // Create Express app
    const app = express();
    // Enable CORS for development
    app.use(cors({
        origin: true,
        credentials: true,
    }));
    // Parse JSON bodies
    app.use(express.json());
    // Create MCP transport in stateless mode to allow multiple workflow sessions
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
        enableJsonResponse: false, // Use SSE streaming
    });
    // Connect MCP server to transport
    await server.connect(transport);
    // Handle all MCP requests at /mcp endpoint
    app.all('/mcp', async (req, res) => {
        try {
            await transport.handleRequest(req, res, req.body);
        }
        catch (error) {
            await errorLog(`Error handling MCP request: ${String(error)}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    // Health check endpoint
    app.get('/health', async (req, res) => {
        const healthIssues: string[] = [];
        let loggingHealthy = false;

        // Check logging service health (single attempt)
        try {
            await infoLog('Health check test message');
            loggingHealthy = true;
        } catch (error) {
            healthIssues.push(`Logging service connection failed: ${String(error)}`);
        }

        if (loggingHealthy) {
            res.json({ 
                status: 'ok', 
                service: 'mealplanner-mcp',
                message: 'All dependencies healthy'
            });
        } else {
            res.status(503).json({ 
                status: 'error', 
                service: 'mealplanner-mcp',
                message: `Health check failed: ${healthIssues.join(', ')}`
            });
        }
    });
    // Start the server
    app.listen(port, () => {
        console.error(`MealPlanner MCP server running on http://localhost:${port}`);
        console.error(`MCP endpoint: http://localhost:${port}/mcp`);
        console.error(`Health check: http://localhost:${port}/health`);
    });
    await infoLog(`MCP server successfully started and connected via HTTP on port ${port}`);
}
main().catch((error) => {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Fatal error in MCP server:', {
        message: err.message,
        stack: err.stack,
        name: err.name
    });
    process.exit(1);
});
