/*
 Update ingredients based on docs/all-ingredients.md
 For each Markdown row: | Meal ID | Ingredient ID | Ingredient Name |
 - If Ingredient Name (after trimming whitespace) is empty -> delete the ingredient
 - Otherwise -> update the ingredient name via API
 Uses the generated SDK: @mealplanner/generated/gateway
 Sleeps 5ms between calls to avoid hammering the gateway.
*/

const fs = require('fs');
const path = require('path');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseMarkdownLine(line) {
  // Expect rows like: | 31 | 218 | name |
  // Split on '|' and trim, ignoring leading/trailing empties
  const parts = line
    .split('|')
    .map((s) => s.trim())
    .filter((_, idx, arr) => !(idx === 0 || idx === arr.length - 1));

  if (parts.length < 3) {
    return null;
  }

  const mealId = parseInt(parts[0], 10);
  const ingredientId = parseInt(parts[1], 10);
  // Unescape escaped pipes in name
  const name = (parts[2] || '').replace(/\\\|/g, '|');

  if (!Number.isFinite(mealId) || !Number.isFinite(ingredientId)) {
    return null;
  }

  return { mealId, ingredientId, name };
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run') || argv.includes('--noop') || argv.includes('-n');
  const { createClient } = require('@mealplanner/generated/gateway/client');
  const {
    putMealsByMealIdIngredientsByIngredientId,
    deleteMealsByMealIdIngredientsByIngredientId,
  } = require('@mealplanner/generated/gateway');

  // The generated SDK mounts endpoints at '/meals', while our gateway serves under '/api'.
  // Point baseUrl to the '/api' prefix for correct routing.
  const baseUrl = process.env.BACKEND_BASE_URL
    ? (process.env.BACKEND_BASE_URL.endsWith('/api')
        ? process.env.BACKEND_BASE_URL
        : `${process.env.BACKEND_BASE_URL.replace(/\/$/, '')}/api`)
    : 'http://127.0.0.1:8090/api';
  const client = createClient({ baseUrl });

  const mdPath = path.join(process.cwd(), 'docs', 'all-ingredients.md');
  if (!fs.existsSync(mdPath)) {
    console.error('File not found:', mdPath);
    process.exit(1);
  }

  const content = fs.readFileSync(mdPath, 'utf8');
  const lines = content.split(/\r?\n/);

  let updated = 0;
  let deleted = 0;
  let skipped = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      continue; // not a table row
    }
    if (trimmed.includes('---') || trimmed.toLowerCase().includes('meal id')) {
      continue; // header row
    }

    const parsed = parseMarkdownLine(trimmed);
    if (!parsed) {
      skipped++;
      continue;
    }

    const { mealId, ingredientId, name } = parsed;
    const newName = (name || '').trim();

    try {
      if (dryRun) {
        if (newName.length === 0) {
          console.log(
            `[DRY RUN] delete ingredient: mealId=${mealId} ingredientId=${ingredientId}`
          );
          deleted++;
        } else {
          console.log(
            `[DRY RUN] update ingredient: mealId=${mealId} ingredientId=${ingredientId} name=\"${newName}\"`
          );
          updated++;
        }
      } else {
        if (newName.length === 0) {
          const resp = await deleteMealsByMealIdIngredientsByIngredientId({
            client,
            path: {
              mealId: mealId.toString(),
              ingredientId: ingredientId.toString(),
            },
          });
          if (resp.error) {
            throw new Error('Delete error: ' + JSON.stringify(resp.error));
          }
          deleted++;
        } else {
          const resp = await putMealsByMealIdIngredientsByIngredientId({
            client,
            path: {
              mealId: mealId.toString(),
              ingredientId: ingredientId.toString(),
            },
            body: {
              mealId,
              ingredientId,
              ingredient: {
                id: ingredientId,
                mealId,
                name: newName,
                quantity: 0,
                unit: '',
              },
            },
          });
          if (resp.error) {
            throw new Error('Update error: ' + JSON.stringify(resp.error));
          }
          updated++;
        }
        // Sleep 5ms between calls (only when we actually call the API)
        await sleep(5);
      }
    } catch (err) {
      console.error(
        `Failed processing meal ${mealId}, ingredient ${ingredientId}:`,
        err && err.message ? err.message : String(err)
      );
    }
  }

  console.log(
    `${dryRun ? '[DRY RUN] ' : ''}Completed. Updated: ${updated}, Deleted: ${deleted}, Skipped: ${skipped}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
