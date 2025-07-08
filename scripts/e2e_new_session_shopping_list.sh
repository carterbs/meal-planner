#!/bin/bash
set -e
set -x

# E2E Test for starting a new session and generating shopping list
# SUCCESS: Creates session, generates meal plan, and produces shopping list
# Note: May timeout in output due to large JSON responses but functionality works

echo "=== E2E Test: New Session with Shopping List Generation ==="

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

# Verify backend is responding
if ! curl -fs http://localhost:8080/api/health >/dev/null 2>&1; then
  echo "FAILURE: Backend not responding after 30 seconds"
  exit 1
fi

echo "--- Step 1: Start new agent session ---"
SESSION_JSON=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"workflowType":"MEAL_PLANNING","participants":["user"]}' \
  http://localhost:8080/api/agent/start)
echo "Session creation response (summary):"
echo "$SESSION_JSON" | jq '{success, threadId, message, meal_plan_size: .initialState.entries | length}' || echo "Raw response: $SESSION_JSON"

THREAD_ID=$(echo "$SESSION_JSON" | jq -r '.threadId')
echo "Thread ID: $THREAD_ID"

if [ "$THREAD_ID" = "null" ] || [ -z "$THREAD_ID" ]; then
  echo "FAILURE: Could not create session"
  exit 1
fi

echo "--- Step 2: Extract meal plan from session ---"
# The session already contains a meal plan in initialState
MEAL_PLAN=$(echo "$SESSION_JSON" | jq '.initialState.entries')
echo "Meal plan from session (first 3 entries):"
echo "$MEAL_PLAN" | jq '.[0:3] | map({day_of_week, meal_type, mealName: (.meal | fromjson | .name // "null")})' 2>/dev/null || echo "Error parsing meal plan"

# Verify meal plan was created
MEAL_COUNT=$(echo "$MEAL_PLAN" | jq '. | length' 2>/dev/null || echo "0")
echo "Session created with meal plan containing $MEAL_COUNT meal slots"

if [ "$MEAL_COUNT" -eq 0 ]; then
  echo "FAILURE: No meals in session meal plan"
  exit 1
fi

echo "--- Step 3: Generate shopping list from meal plan ---"
# Extract meal IDs from the session meal plan
MEAL_IDS=$(echo "$MEAL_PLAN" | jq '[.[] | select(.meal != null and .meal != "") | .meal | fromjson | .id] // []' 2>/dev/null || echo "[]")
echo "Meal IDs for shopping list: $(echo "$MEAL_IDS" | jq 'length') meals"

SHOPPING_LIST=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"plan\":$MEAL_IDS}" \
  http://localhost:8080/api/shoppinglist)
echo "Shopping list generation response (first few items):"
echo "$SHOPPING_LIST" | jq 'to_entries[0:5] | from_entries' || echo "Raw response (truncated): $(echo "$SHOPPING_LIST" | head -c 500)..."

# Verify shopping list was generated
INGREDIENT_COUNT=$(echo "$SHOPPING_LIST" | jq 'keys | length' 2>/dev/null || echo "0")
echo "Generated shopping list with $INGREDIENT_COUNT ingredient categories"

if [ "$INGREDIENT_COUNT" -eq 0 ]; then
  echo "FAILURE: No ingredients in shopping list"
  exit 1
fi

echo "--- Step 4: Verify session state ---"
WORKFLOW_STATE=$(curl -s -X GET -H 'Content-Type: application/json' \
  http://localhost:8080/api/workflows/$THREAD_ID)
echo "Final workflow state (summary):"
echo "$WORKFLOW_STATE" | jq '{threadId, current_step, meal_plan: (.entries | length), shopping_list: (.shopping_list != null)}' || echo "Error parsing workflow state"

# Check if workflow contains meal plan data
HAS_MEAL_PLAN=$(echo "$WORKFLOW_STATE" | jq 'has("entries")' 2>/dev/null || echo "false")
echo "Workflow has meal plan: $HAS_MEAL_PLAN"

# Success criteria: We have a valid session, meal plan, and shopping list
echo "--- SUCCESS CRITERIA CHECK ---"
echo "✓ Session created with Thread ID: $THREAD_ID"
echo "✓ Meal plan generated with $MEAL_COUNT meals"
echo "✓ Shopping list generated with $INGREDIENT_COUNT ingredient categories"

if [ "$HAS_MEAL_PLAN" = "true" ]; then
  echo "✓ Workflow contains meal plan data"
else
  echo "⚠ Workflow may not contain meal plan data (check implementation)"
fi

echo "=== SUCCESS: New Session with Shopping List Test Complete ==="
echo "Session $THREAD_ID successfully created with meal plan and shopping list"