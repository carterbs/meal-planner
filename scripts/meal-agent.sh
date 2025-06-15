#!/usr/bin/env bash

# Meal Agent CLI Entry Point
# This script provides a convenient way to run the meal planning agent CLI

set -e

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
AGENT_DIR="$PROJECT_ROOT/agent"

# Check if we're in the right directory structure
if [ ! -d "$AGENT_DIR" ]; then
    echo "❌ Error: Agent directory not found at $AGENT_DIR"
    echo "   Make sure you're running this script from the correct project location."
    exit 1
fi

# Check if agent is built
if [ ! -f "$AGENT_DIR/dist/cli.js" ]; then
    echo "🔄 Building agent CLI..."
    cd "$AGENT_DIR"
    yarn build
    
    if [ $? -ne 0 ]; then
        echo "❌ Error: Failed to build agent CLI"
        exit 1
    fi
fi

# Check for required environment variables
if [ -z "$DB_HOST" ] && [ ! -f "$AGENT_DIR/.env" ]; then
    echo "⚠️  Warning: No database configuration found."
    echo "   Either set environment variables (DB_HOST, DB_PORT, etc.) or create $AGENT_DIR/.env"
    echo "   Using defaults: localhost:5432/meal_planner_dev"
fi

# Run the CLI with all arguments passed through
cd "$AGENT_DIR"
node --env-file=.env dist/cli.js "$@"