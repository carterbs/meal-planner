#!/bin/bash
set -e
set -x

# Kill any backend on 8080
lsof -ti:8080 | xargs -r kill -9

# Start backend
pushd meal-service > /dev/null
go run . &
BACKEND_PID=$!
popd > /dev/null
trap "kill $BACKEND_PID" EXIT

# Wait for backend to be ready
for i in {1..30}; do
  curl -fs http://localhost:8080/api/health >/dev/null && break
  sleep 1
done

# Create a new workflow session
SESSION_JSON=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"workflowType":"MEAL_PLANNING","participants":["user"]}' \
  http://localhost:8080/api/agent/start)
THREAD_ID=$(echo "$SESSION_JSON" | jq -r '.threadId')
echo "Session created. THREAD_ID=$THREAD_ID"

# Send a user message
curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"threadId\":\"$THREAD_ID\",\"message\":\"I want broccoli this week!\",\"from\":\"user\"}" \
  http://localhost:8080/api/agent/message


# Fetch workflow state
STATE=$(curl -s http://localhost:8080/api/workflows/$THREAD_ID)
echo "=== FULL MESSAGE HISTORY ==="
echo "$STATE" | jq '.messages'

# Print agent and user messages interleaved
USER_MSGS=$(echo "$STATE" | jq '[.messages[] | select(.sender == "user")]')
AGENT_MSGS=$(echo "$STATE" | jq '[.messages[] | select(.sender == "agent")]')
echo "=== USER MESSAGES ==="
echo "$USER_MSGS"
echo "=== AGENT MESSAGES ==="
echo "$AGENT_MSGS"

# Check that both user and agent messages are present
USER_COUNT=$(echo "$USER_MSGS" | jq 'length')
AGENT_COUNT=$(echo "$AGENT_MSGS" | jq 'length')
echo "USER COUNT: $USER_COUNT"
echo "AGENT COUNT: $AGENT_COUNT"
if [[ $USER_COUNT -ge 1 && $AGENT_COUNT -ge 2 ]]; then
  echo 'PASS: User and agent messages present. Full chat history:'
  echo "All USER messages:"
  echo "$USER_MSGS"
  echo "All AGENT messages:"
  echo "$AGENT_MSGS"
  exit 0
else
  echo 'FAIL: Missing user or agent messages in workflow history.'
  echo "USER COUNT: $USER_COUNT"
  echo "AGENT COUNT: $AGENT_COUNT"
  echo "All USER messages:"
  echo "$USER_MSGS"
  echo "All AGENT messages:"
  echo "$AGENT_MSGS"
  exit 1
fi
