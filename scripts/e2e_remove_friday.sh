#!/bin/bash
set -x
yarn kill:servers
pushd backend
  echo '--- Starting backend ---'
  go run . &
popd
pushd api-gateway
  echo '--- Starting API gateway ---'
  go run . &
popd

echo "--- Waiting for backend to be ready ---"
for i in {1..30}; do
  curl -fs http://localhost:8080/api/health >/dev/null && break
  sleep 1
done

echo "--- Creating session ---"
SESSION_JSON=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"workflowType":"MEAL_PLANNING","participants":["user"]}' \
  http://localhost:8080/api/agent/start)
THREAD_ID=$(echo "$SESSION_JSON" | jq -r '.threadId')

echo "--- Sending message to remove Friday ---"
curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"threadId\":\"$THREAD_ID\",\"message\":\"remove all of friday's meals\",\"from\":\"user\"}" \
  http://localhost:8080/api/agent/message

echo "--- Fetching state and checking results ---"
STATE=$(curl -s http://localhost:8080/api/workflows/$THREAD_ID)

echo "=== FRIDAY MEALS (dayIndex 4) ==="
echo "$STATE" | jq '.entries[] | select(.day_index == 4)' | jq -s '.'

echo "=== SATURDAY MEALS (dayIndex 5) ==="
echo "$STATE" | jq '.entries[] | select(.day_index == 5)' | jq -s '.'

echo "=== DAY NAMES MAPPING ==="
echo "0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday"

# Check if Friday (dayIndex 4) meals are removed
FRIDAY_MEALS_REMOVED=$(echo "$STATE" | jq '[.entries[] | select(.day_index == 4 and .meal != null and .meal != "")] | length == 0')
echo "Friday meals removed: $FRIDAY_MEALS_REMOVED"

# Check if Saturday (dayIndex 5) meals are removed  
SATURDAY_MEALS_REMOVED=$(echo "$STATE" | jq '[.entries[] | select(.day_index == 5 and .meal != null and .meal != "")] | length == 0')
echo "Saturday meals removed: $SATURDAY_MEALS_REMOVED"