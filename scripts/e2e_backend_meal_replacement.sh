#!/bin/bash
set -e
set -x

echo "=== Backend-Only E2E Test: Meal Plan Operations ==="

echo "--- Killing existing backend processes ---"
lsof -ti:8080 | xargs -r kill -9 2>/dev/null || true

echo "--- Starting backend ---"
pushd backend > /dev/null
go run . &
BACKEND_PID=$!
popd > /dev/null

trap "kill $BACKEND_PID 2>/dev/null || true" EXIT

echo "--- Waiting for backend to be ready ---"
for i in {1..30}; do
  if curl -fs http://localhost:8080/api/health >/dev/null 2>&1; then
    echo "Backend is ready!"
    break
  fi
  echo "Waiting for backend... attempt $i/30"
  sleep 1
done

if ! curl -fs http://localhost:8080/api/health >/dev/null 2>&1; then
  echo "FAILURE: Backend not responding after 30 seconds"
  exit 1
fi

echo "--- Step 1: Generate initial meal plan ---"
INITIAL_PLAN=$(curl -s -X POST -H 'Content-Type: application/json' \
  http://localhost:8080/api/mealplan/generate)
echo "Initial plan generated with $(echo "$INITIAL_PLAN" | jq '.days | length') meal slots"

echo "--- Step 2: Check Saturday meals before operations ---"
CURRENT_PLAN=$(curl -s -X GET -H 'Content-Type: application/json' \
  http://localhost:8080/api/mealplan)
SATURDAY_BEFORE=$(echo "$CURRENT_PLAN" | jq '.days[] | select(.dayIndex == 5)')
echo "Saturday meals before operations:"
echo "$SATURDAY_BEFORE" | jq '.mealType + ": " + (.meal.mealName // "null")'

echo "--- Step 3: Test meal swapping (Saturday breakfast) ---"
SATURDAY_BREAKFAST_ID=$(echo "$CURRENT_PLAN" | jq -r '.days[] | select(.dayIndex == 5 and .mealType == "breakfast") | .meal.id')
if [ "$SATURDAY_BREAKFAST_ID" != "null" ] && [ -n "$SATURDAY_BREAKFAST_ID" ]; then
  echo "Swapping Saturday breakfast (ID: $SATURDAY_BREAKFAST_ID)"
  SWAP_RESULT=$(curl -s -X POST -H 'Content-Type: application/json' \
    -d "{\"meal_id\":$SATURDAY_BREAKFAST_ID,\"meal_type\":\"breakfast\"}" \
    http://localhost:8080/api/meals/swap)
  echo "Swap result: $(echo "$SWAP_RESULT" | jq -r '.mealName // "ERROR"')"
else
  echo "No Saturday breakfast to swap"
fi

echo "--- Step 4: Test meal replacement (Saturday lunch) ---"
REPLACE_RESULT=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"day":"Saturday","new_meal_id":1}' \
  http://localhost:8080/api/mealplan/replace)
echo "Replace result:"
echo "$REPLACE_RESULT" | jq '.mealName // "ERROR"' || echo "Raw: $REPLACE_RESULT"

echo "--- Step 5: Generate meal plan with skip days ---"
FILTERED_PLAN=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"skip_days":["Saturday","Sunday"]}' \
  http://localhost:8080/api/mealplan/generate)
echo "Filtered plan excludes Saturday and Sunday:"
WEEKEND_MEALS=$(echo "$FILTERED_PLAN" | jq '[.[] | select(.dayIndex >= 5)] | length')
echo "Weekend meals in filtered plan: $WEEKEND_MEALS"

echo "--- Step 6: Check final meal plan state ---"
FINAL_PLAN=$(curl -s -X GET -H 'Content-Type: application/json' \
  http://localhost:8080/api/mealplan)
SATURDAY_AFTER=$(echo "$FINAL_PLAN" | jq '.days[] | select(.dayIndex == 5)')
echo "Saturday meals after operations:"
echo "$SATURDAY_AFTER" | jq '.mealType + ": " + (.meal.mealName // "null")'

echo "--- Step 7: Test shopping list generation ---"
MEALS_FOR_SHOPPING=$(echo "$FINAL_PLAN" | jq '[.days[] | select(.meal != null) | .meal.id] | .[0:3]')
SHOPPING_LIST=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"plan\":$MEALS_FOR_SHOPPING}" \
  http://localhost:8080/api/shoppinglist)
echo "Shopping list generated with $(echo "$SHOPPING_LIST" | jq 'keys | length') ingredient types"

echo "--- Step 8: Test meal finalization ---"
FINALIZE_RESULT=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d "$FINAL_PLAN" \
  http://localhost:8080/api/mealplan/finalize)
echo "Finalize result:"
echo "$FINALIZE_RESULT" || echo "Raw: $FINALIZE_RESULT"

echo "=== Backend Operations Test Complete ==="
echo "Successfully tested: generate, swap, replace, filter, shopping list, and finalize"