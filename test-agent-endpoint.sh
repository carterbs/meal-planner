#!/bin/bash
set -e

# -------- Start a new meal planning workflow --------
echo "# Start Workflow"
START_PAYLOAD='{ "participants": ["brad", "shannon"], "workflow_type": "meal_planning" }'
echo "$START_PAYLOAD" | jq '.'
START_RESPONSE=$(curl -s -f -X POST http://localhost:8080/api/agent/start \
  -H "Content-Type: application/json" \
  -d "$START_PAYLOAD")
echo "$START_RESPONSE" | jq '.'
THREAD_ID=$(echo "$START_RESPONSE" | jq -r '.threadId')
if [ -z "$THREAD_ID" ] || [ "$THREAD_ID" == "null" ]; then
  echo "[ERROR] Failed to get threadId from start response."
  exit 1
fi

# -------- Get workflow status --------
echo "# Get Workflow Status"
curl -s -f -X GET "http://localhost:8080/api/agent/status/$THREAD_ID" | jq '.'

# -------- Resume workflow (advance to await_feedback) --------
echo "# Resume Workflow (expecting state to become 'await_feedback')"
RESUME_JSON='{ "threadId": "'$THREAD_ID'", "interactive": false }'
echo "$RESUME_JSON" | jq '.'
curl -s -f -X POST http://localhost:8080/api/agent/resume \
  -H "Content-Type: application/json" \
  -d "$RESUME_JSON" | jq '.'

# -------- Get workflow status --------
echo "# Get Workflow Status"
curl -s -f -X GET "http://localhost:8080/api/agent/status/$THREAD_ID" | jq '.'


# -------- Add feedback 1 (now in await_feedback) --------
echo "# Add Feedback 1"
FEEDBACK_JSON_1='{ "threadId": "'$THREAD_ID'", "message": "I like this meal plan, but can we have more vegetarian options?", "from": "brad" }'
echo "$FEEDBACK_JSON_1" | jq '.'
curl -s -f -X POST http://localhost:8080/api/agent/feedback \
  -H "Content-Type: application/json" \
  -d "$FEEDBACK_JSON_1" | jq '.'

# -------- Get workflow status --------
echo "# Get Workflow Status"
curl -s -f -X GET "http://localhost:8080/api/agent/status/$THREAD_ID" | jq '.'

# -------- Resume workflow --------
echo "# Resume Workflow"
RESUME_JSON='{ "threadId": "'$THREAD_ID'", "interactive": false }'
echo "$RESUME_JSON" | jq '.'
curl -s -f -X POST http://localhost:8080/api/agent/resume \
  -H "Content-Type: application/json" \
  -d "$RESUME_JSON" | jq '.'

# -------- Get workflow status --------
echo "# Get Workflow Status"
curl -s -f -X GET "http://localhost:8080/api/agent/status/$THREAD_ID" | jq '.'


# -------- Resume workflow (advance to await_feedback for feedback 2) --------
echo "# Resume Workflow (expecting state to become 'await_feedback')"
RESUME_JSON='{ "threadId": "'$THREAD_ID'", "interactive": false }'
echo "$RESUME_JSON" | jq '.'
curl -s -f -X POST http://localhost:8080/api/agent/resume \
  -H "Content-Type: application/json" \
  -d "$RESUME_JSON" | jq '.'

# -------- Add feedback 2 (now in await_feedback) --------
echo "# Add Feedback 2"
FEEDBACK_JSON_2='{ "threadId": "'$THREAD_ID'", "message": "Can you reduce the amount of dairy in the plan?", "from": "shannon" }'
echo "$FEEDBACK_JSON_2" | jq '.'
curl -s -f -X POST http://localhost:8080/api/agent/feedback \
  -H "Content-Type: application/json" \
  -d "$FEEDBACK_JSON_2" | jq '.'

# -------- Resume workflow (advance to await_feedback for feedback 3) --------
echo "# Resume Workflow (expecting state to become 'await_feedback')"
RESUME_JSON='{ "threadId": "'$THREAD_ID'", "interactive": false }'
echo "$RESUME_JSON" | jq '.'
curl -s -f -X POST http://localhost:8080/api/agent/resume \
  -H "Content-Type: application/json" \
  -d "$RESUME_JSON" | jq '.'

# -------- Add feedback 3 (now in await_feedback) --------
echo "# Add Feedback 3"
FEEDBACK_JSON_3='{ "threadId": "'$THREAD_ID'", "message": "Please add more high-protein dinner options.", "from": "brad" }'
echo "$FEEDBACK_JSON_3" | jq '.'
curl -s -f -X POST http://localhost:8080/api/agent/feedback \
  -H "Content-Type: application/json" \
  -d "$FEEDBACK_JSON_3" | jq '.'

# -------- Resume workflow --------
echo "# Resume Workflow"
RESUME_JSON='{ "threadId": "'$THREAD_ID'", "interactive": false }'
echo "$RESUME_JSON" | jq '.'
curl -s -f -X POST http://localhost:8080/api/agent/resume \
  -H "Content-Type: application/json" \
  -d "$RESUME_JSON" | jq '.'

# -------- Final workflow status --------
echo "# Final Workflow Status"
curl -s -f -X GET "http://localhost:8080/api/agent/status/$THREAD_ID" | jq '.'

echo "# Test Complete (exit code $?)"
