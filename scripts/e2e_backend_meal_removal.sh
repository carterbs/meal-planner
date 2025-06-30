#!/bin/bash
set -e
set -x

echo "=== Backend-Only E2E Test: Meal Removal ==="

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

echo "--- Step 1: Generate initial meal plan ---"
INITIAL_PLAN=$(curl -s -X POST -H 'Content-Type: application/json' \
  http://localhost:8080/api/mealplan/generate)
echo "Initial plan response:"
echo "$INITIAL_PLAN" | jq . || echo "Raw response: $INITIAL_PLAN"

echo "--- Step 2: Check Saturday meals before removal ---"
CURRENT_PLAN=$(curl -s -X GET -H 'Content-Type: application/json' \
  http://localhost:8080/api/mealplan)
echo "Current plan response:"
echo "$CURRENT_PLAN" | jq . || echo "Raw response: $CURRENT_PLAN"

SATURDAY_BEFORE=$(echo "$CURRENT_PLAN" | jq '.days[] | select(.dayIndex == 5)')
echo "Saturday meals before removal:"
echo "$SATURDAY_BEFORE" | jq . || echo "Raw Saturday data: $SATURDAY_BEFORE"

echo "--- Step 3: Create agent session for meal removal ---"
SESSION_JSON=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"workflowType":"MEAL_PLANNING","participants":["user"]}' \
  http://localhost:8080/api/agent/start)
echo "Session creation response:"
echo "$SESSION_JSON" | jq . || echo "Raw response: $SESSION_JSON"

THREAD_ID=$(echo "$SESSION_JSON" | jq -r '.threadId')
echo "Thread ID: $THREAD_ID"

if [ "$THREAD_ID" = "null" ] || [ -z "$THREAD_ID" ]; then
  echo "FAILURE: Could not create session"
  exit 1
fi

echo "--- Step 4: Remove Saturday breakfast ---"
REMOVE_BREAKFAST=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"threadId\":\"$THREAD_ID\",\"dayIndex\":5,\"mealType\":\"breakfast\"}" \
  http://localhost:8080/api/meals/remove)
echo "Remove breakfast response:"
echo "$REMOVE_BREAKFAST" | jq . || echo "Raw response: $REMOVE_BREAKFAST"

echo "--- Step 5: Remove Saturday lunch ---"
REMOVE_LUNCH=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"threadId\":\"$THREAD_ID\",\"dayIndex\":5,\"mealType\":\"lunch\"}" \
  http://localhost:8080/api/meals/remove)
echo "Remove lunch response:"
echo "$REMOVE_LUNCH" | jq . || echo "Raw response: $REMOVE_LUNCH"

echo "--- Step 6: Remove Saturday dinner ---"
REMOVE_DINNER=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"threadId\":\"$THREAD_ID\",\"dayIndex\":5,\"mealType\":\"dinner\"}" \
  http://localhost:8080/api/meals/remove)
echo "Remove dinner response:"
echo "$REMOVE_DINNER" | jq . || echo "Raw response: $REMOVE_DINNER"

echo "--- Step 7: Get workflow state to see if meal plan is fucked ---"
WORKFLOW_STATE=$(curl -s -X GET -H 'Content-Type: application/json' \
  http://localhost:8080/api/workflows/$THREAD_ID)
echo "Workflow state response:"
echo "$WORKFLOW_STATE" | jq . || echo "Raw response: $WORKFLOW_STATE"

echo "--- Step 8: Check meal plan state ---"
MEAL_PLAN_STATE=$(echo "$WORKFLOW_STATE" | jq '.meal_plan // .mealPlan // empty')
echo "Meal plan from workflow:"
echo "$MEAL_PLAN_STATE" | jq . || echo "Raw meal plan: $MEAL_PLAN_STATE"

echo "--- Step 9: Verify Saturday meals are removed ---"
SATURDAY_AFTER=$(echo "$MEAL_PLAN_STATE" | jq '.days[] | select(.dayIndex == 5)' 2>/dev/null || echo "")
echo "Saturday meals after removal:"
echo "$SATURDAY_AFTER" | jq . || echo "Raw Saturday data: $SATURDAY_AFTER"

if [ -z "$SATURDAY_AFTER" ]; then
  echo "SUCCESS: No Saturday meals found after removal"
else
  # Check if all Saturday meals are null
  NULL_COUNT=$(echo "$SATURDAY_AFTER" | jq '[.meal == null] | length' 2>/dev/null || echo "0")
  TOTAL_COUNT=$(echo "$SATURDAY_AFTER" | jq '. | length' 2>/dev/null || echo "0")
  
  echo "Saturday meal analysis: $NULL_COUNT null meals out of $TOTAL_COUNT total"
  
  if [ "$NULL_COUNT" -eq "$TOTAL_COUNT" ] && [ "$TOTAL_COUNT" -gt 0 ]; then
    echo "SUCCESS: All Saturday meals are null"
  else
    echo "FAILURE: Saturday meals were not properly removed"
    echo "Full workflow state for debugging:"
    echo "$WORKFLOW_STATE" | jq . || echo "$WORKFLOW_STATE"
    exit 1
  fi
fi

echo "=== Test Complete ==="