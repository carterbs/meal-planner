import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MealPlanner MCP server running on stdio');
}

main().catch((err) => {
  console.error('Server error:', err);
  process.exit(1);
});
