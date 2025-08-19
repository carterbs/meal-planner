#!/bin/bash

# This script runs the swagger response type linter on the api-gateway

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Get the project root (two directories up)
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Run the linter
echo "Running Swagger response type linter..."
cd "$SCRIPT_DIR"
go run check_swagger_responses.go "$PROJECT_ROOT/api-gateway"