#!/bin/bash
set -x


echo "--- Killing existing backend processes ---"
# kill_backend
lsof -ti:8080 | xargs -r kill -9

echo "--- Starting backend ---"
# start_backend
echo "Starting backend..."
pushd meal-service > /dev/null
go run . &
popd > /dev/null

BACKEND_PID=$!
trap "kill $BACKEND_PID" EXIT

echo "--- Waiting for backend to be ready ---"
# wait_until_ready
for i in {1..30}; do
  curl -fs http://localhost:8080/api/health >/dev/null && break
  sleep 1
done

echo "--- Creating session ---"
# create_session
SESSION_JSON=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"workflowType":"MEAL_PLANNING","participants":["user"]}' \
  http://localhost:8080/api/agent/start)
THREAD_ID=$(echo "$SESSION_JSON" | jq -r '.threadId')

echo "--- Sending message ---"
# send_message
curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"threadId\":\"$THREAD_ID\",\"message\":\"remove saturday's meals\",\"from\":\"user\"}" \
  http://localhost:8080/api/agent/message >/dev/null


echo "--- Fetching state and validating ---"
# fetch_state & validate_saturday
STATE=$(curl -s http://localhost:8080/api/workflows/$THREAD_ID)
# Validate that no meals remain for Saturday (day_of_week == 5)
if echo "$STATE" | jq -e '[.entries[] | select(.day_of_week == 5 and .meal != null and .meal != "")] | length == 0' >/dev/null; then
  echo "success"
else
  echo "Full state:"
  echo "$STATE"
  echo "FAILURE: Saturday meals were not removed"
  exit 1
fi
