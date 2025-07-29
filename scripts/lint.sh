#!/bin/bash

# lint.sh - Run all linting checks for the meal-planner project
#
# This script runs:
# 1. Custom swagger response linter to ensure all @Success annotations use proto types
# 2. Standard Go linters if available (golangci-lint)
#
# Exit codes:
# 0 - All linting passed
# 1 - Linting violations found
# 2 - Script setup/configuration error

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Get the project root (one directory up from scripts)
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Track overall exit status
EXIT_STATUS=0

# Function to print colored messages
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "========================================="
echo "Running linting checks for meal-planner"
echo "========================================="
echo ""

# 1. Run custom swagger response linter
log_info "Running custom Swagger response linter..."

if [ -f "$PROJECT_ROOT/tools/linter/check-swagger-responses" ]; then
    # Use compiled binary if available
    "$PROJECT_ROOT/tools/linter/check-swagger-responses" "$PROJECT_ROOT/api-gateway"
    SWAGGER_EXIT=$?
elif [ -f "$PROJECT_ROOT/tools/linter/check_swagger_responses.go" ]; then
    # Fall back to running with go run
    cd "$PROJECT_ROOT/tools/linter"
    go run check_swagger_responses.go "$PROJECT_ROOT/api-gateway"
    SWAGGER_EXIT=$?
    cd "$PROJECT_ROOT"
else
    log_error "Swagger response linter not found!"
    log_error "Expected at: $PROJECT_ROOT/tools/linter/check_swagger_responses.go"
    exit 2
fi

if [ $SWAGGER_EXIT -ne 0 ]; then
    log_error "Swagger response linting failed!"
    EXIT_STATUS=1
else
    log_info "Swagger response linting passed!"
fi

echo ""

# 2. Run golangci-lint if available
if command -v golangci-lint &> /dev/null; then
    log_info "Running golangci-lint..."
    
    # Run golangci-lint for each Go module in the project
    GO_MODULES=(
        "api-gateway"
        "meal-service"
        "logging-service"
        "tools/linter"
    )
    
    for module in "${GO_MODULES[@]}"; do
        if [ -d "$PROJECT_ROOT/$module" ] && [ -f "$PROJECT_ROOT/$module/go.mod" ]; then
            echo ""
            log_info "Linting $module..."
            cd "$PROJECT_ROOT/$module"
            
            if golangci-lint run ./...; then
                log_info "$module linting passed!"
            else
                log_error "$module linting failed!"
                EXIT_STATUS=1
            fi
        else
            log_warn "Skipping $module - directory or go.mod not found"
        fi
    done
    
    cd "$PROJECT_ROOT"
else
    log_warn "golangci-lint not found. Skipping standard Go linting."
    log_warn "Install with: go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest"
fi

echo ""

# 3. Run go vet for basic checks (always available with Go)
log_info "Running go vet..."

for module in "${GO_MODULES[@]}"; do
    if [ -d "$PROJECT_ROOT/$module" ] && [ -f "$PROJECT_ROOT/$module/go.mod" ]; then
        echo ""
        log_info "Running go vet on $module..."
        cd "$PROJECT_ROOT/$module"
        
        if go vet ./...; then
            log_info "$module go vet passed!"
        else
            log_error "$module go vet failed!"
            EXIT_STATUS=1
        fi
    fi
done

cd "$PROJECT_ROOT"

echo ""
echo "========================================="

# Report final status
if [ $EXIT_STATUS -eq 0 ]; then
    log_info "All linting checks passed!"
else
    log_error "Some linting checks failed!"
fi

echo "========================================="

exit $EXIT_STATUS