/*
 Small utility: Fetch all meals from the local API gateway and write a
 Markdown file listing one ingredient per row: meal ID | ingredient ID | name.
 Uses the generated SDK: @mealplanner/generated/gateway.
*/

const fs = require('fs');
const path = require('path');

async function main() {
  const { createClient } = require('@mealplanner/generated/gateway/client');
  const { getMeals } = require('@mealplanner/generated/gateway');

  // The generated SDK mounts endpoints at '/meals', while our gateway serves under '/api'.
  // Point baseUrl to the '/api' prefix for correct routing.
  const baseUrl = process.env.BACKEND_BASE_URL
    ? (process.env.BACKEND_BASE_URL.endsWith('/api') ? process.env.BACKEND_BASE_URL : `${process.env.BACKEND_BASE_URL.replace(/\/$/, '')}/api`)
    : 'http://127.0.0.1:8090/api';
  const client = createClient({ baseUrl });

  const resp = await getMeals({ client });
  if (resp.error) {
    throw new Error('Failed to fetch meals: ' + JSON.stringify(resp.error));
  }
  const meals = resp.data && resp.data.meals ? resp.data.meals : [];

  const lines = [];
  lines.push('| Meal ID | Ingredient ID | Ingredient Name |');
  lines.push('| --- | --- | --- |');

  for (const meal of meals) {
    const mid = meal.id;
    const ingredients = Array.isArray(meal.ingredients) ? meal.ingredients : [];
    for (const ing of ingredients) {
      const iid = ing.id;
      // Escape pipe characters to not break the table
      const name = (ing.name || '').replace(/\|/g, '\\|');
      lines.push(`| ${mid} | ${iid} | ${name} |`);
    }
  }

  const outDir = path.join(process.cwd(), 'docs');
  const outFile = path.join(outDir, 'all-ingredients.md');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, lines.join('\n') + '\n', 'utf8');
  console.log('Wrote', outFile, 'with', lines.length - 2, 'ingredients.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
