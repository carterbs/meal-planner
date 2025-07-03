#!/bin/bash
set -e
set -x

echo "=== gRPC E2E Test: Health Check ==="

echo "--- Checking if grpcurl is available ---"
if ! command -v grpcurl &> /dev/null; then
    echo "grpcurl not found. Installing via homebrew..."
    brew install grpcurl
fi

echo "--- Killing existing backend processes ---"
lsof -ti:8080 | xargs -r kill -9 2>/dev/null || true
lsof -ti:9090 | xargs -r kill -9 2>/dev/null || true

echo "--- Starting backend ---"
pushd backend > /dev/null
go run . &
BACKEND_PID=$!
popd > /dev/null

trap "kill $BACKEND_PID 2>/dev/null || true" EXIT

echo "--- Waiting for HTTP backend to be ready ---"
for i in {1..30}; do
  if curl -fs http://localhost:8080/api/health >/dev/null 2>&1; then
    echo "HTTP backend is ready!"
    break
  fi
  echo "Waiting for HTTP backend... attempt $i/30"
  sleep 1
done

# Verify HTTP backend is responding
if ! curl -fs http://localhost:8080/api/health >/dev/null 2>&1; then
  echo "FAILURE: HTTP backend not responding after 30 seconds"
  exit 1
fi

echo "--- Waiting for gRPC backend to be ready ---"
for i in {1..30}; do
  if grpcurl -plaintext localhost:9090 list >/dev/null 2>&1; then
    echo "gRPC backend is ready!"
    break
  fi
  echo "Waiting for gRPC backend... attempt $i/30"
  sleep 1
done

# Verify gRPC backend is responding
if ! grpcurl -plaintext localhost:9090 list >/dev/null 2>&1; then
  echo "FAILURE: gRPC backend not responding after 30 seconds"
  exit 1
fi

echo "--- Step 1: List available gRPC services ---"
echo "Available services:"
grpcurl -plaintext localhost:9090 list

echo "--- Step 2: List BackendService methods ---"
echo "BackendService methods:"
grpcurl -plaintext localhost:9090 list mealplanner.BackendService

echo "--- Step 3: Test gRPC Health Check ---"
echo "gRPC Health Check response:"
grpcurl -plaintext -d '{}' localhost:9090 mealplanner.BackendService/HealthCheck

echo "--- Step 4: Test GetAllMeals via gRPC ---"
echo "GetAllMeals response:"
grpcurl -plaintext -d '{}' localhost:9090 mealplanner.BackendService/GetAllMeals

echo "--- Step 5: Test GetAllMeals with meal type filter ---"
echo "GetAllMeals (dinner only) response:"
grpcurl -plaintext -d '{"meal_type": "dinner"}' localhost:9090 mealplanner.BackendService/GetAllMeals

echo "=== gRPC Test Complete ==="