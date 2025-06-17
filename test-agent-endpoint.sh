#!/bin/bash
set -e
set -x

# Test 0: Start a new meal planning workflow
echo "=== Starting new meal planning workflow ==="
START_PAYLOAD=$(cat <<EOF
{
  "participants": ["brad", "shannon"],
  "workflow_type": "meal_planning"
}
EOF
)
echo "Request Payload:"
echo "$START_PAYLOAD" | jq '.'

START_RESPONSE=$(curl -s -f -X POST http://localhost:8080/api/agent/start \
  -H "Content-Type: application/json" \
  -d "$START_PAYLOAD")

echo "Response:"
echo "$START_RESPONSE" | jq '.'

THREAD_ID=$(echo "$START_RESPONSE" | jq -r '.thread_id')

if [ -z "$THREAD_ID" ] || [ "$THREAD_ID" == "null" ]; then
  echo "Error: Failed to get thread_id from start response."
  echo "Full response: $START_RESPONSE"
  exit 1
fi

echo -e "\n=== Testing with new thread ID: $THREAD_ID ===\n"

# Test 1: Get workflow status
echo "=== Getting workflow status ==="
curl -s -f -X GET "http://localhost:8080/api/agent/status/$THREAD_ID" | jq '.'

# Test 2: Add feedback 1
echo -e "\n=== Adding feedback 1 ==="
FEEDBACK_JSON_1=$(cat <<EOF
{
  "thread_id": "$THREAD_ID",
  "message": "I like this meal plan, but can we have more vegetarian options?",
  "from": "brad"
}
EOF
)
echo "$FEEDBACK_JSON_1" | jq '.'
curl -s -f -X POST http://localhost:8080/api/agent/feedback \
  -H "Content-Type: application/json" \
  -d "$FEEDBACK_JSON_1" | jq '.'

# Test 2: Add feedback 2
echo -e "\n=== Adding feedback 2 ==="
FEEDBACK_JSON_2=$(cat <<EOF
{
  "thread_id": "$THREAD_ID",
  "message": "Can you reduce the amount of dairy in the plan?",
  "from": "shannon"
}
EOF
)
echo "$FEEDBACK_JSON_2" | jq '.'
curl -s -f -X POST http://localhost:8080/api/agent/feedback \
  -H "Content-Type: application/json" \
  -d "$FEEDBACK_JSON_2" | jq '.'

# Test 2: Add feedback 3
echo -e "\n=== Adding feedback 3 ==="
FEEDBACK_JSON_3=$(cat <<EOF
{
  "thread_id": "$THREAD_ID",
  "message": "Please add more high-protein dinner options.",
  "from": "brad"
}
EOF
)
echo "$FEEDBACK_JSON_3" | jq '.'
curl -s -f -X POST http://localhost:8080/api/agent/feedback \
  -H "Content-Type: application/json" \
  -d "$FEEDBACK_JSON_3" | jq '.'

# Test 3: Resume workflow
echo -e "\n=== Resuming workflow ==="
RESUME_JSON=$(cat <<EOF
{
  "thread_id": "$THREAD_ID",
  "interactive": false
}
EOF
)
echo "$RESUME_JSON" | jq '.'
# Note: The resume endpoint for the agent CLI might output non-JSON debug lines first.
# The backend handler should ensure only the final JSON is passed through.
# For this test, we'll pipe to jq and expect it to pick the valid JSON if present.
curl -s -f -X POST http://localhost:8080/api/agent/resume \
  -H "Content-Type: application/json" \
  -d "$RESUME_JSON" | jq '.'

# Test 4: Get final status
echo -e "\n=== Final workflow status ==="
curl -s -f -X GET "http://localhost:8080/api/agent/status/$THREAD_ID" | jq '.'

echo -e "\n=== Test complete ==="
echo "Script exited with code $?"
