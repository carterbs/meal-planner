# meal-planner root Makefile
#
# This Makefile provides targets for building, testing, and maintaining
# the meal-planner application.

.PHONY: help lint swagger generate build test clean

# Default target - show help
help:
	@echo "meal-planner Makefile"
	@echo "===================="
	@echo ""
	@echo "Available targets:"
	@echo "  make lint      - Run all linting checks (custom swagger linter + Go linters)"
	@echo "  make swagger   - Generate Swagger/OpenAPI documentation"
	@echo "  make generate  - Generate all code (proto, swagger, TypeScript client)"
	@echo "  make build     - Build all services"
	@echo "  make test      - Run all tests"
	@echo "  make clean     - Clean generated files and build artifacts"
	@echo ""
	@echo "Development workflow:"
	@echo "  make lint && make generate  - Lint first, then generate code"

# Run linting checks
# This should be run before any code generation to catch issues early
lint:
	@echo "Running linting checks..."
	@./scripts/lint.sh
	cd ui && yarn format

# Generate Swagger/OpenAPI documentation
# Depends on lint to ensure code quality before generation
swagger: lint
	@echo "Generating Swagger documentation..."
	@./scripts/gateway-gen.sh

# Generate all code (proto, swagger, TypeScript)
# Depends on lint to ensure code quality before generation
generate: lint
	@echo "Generating all code..."
	@echo ""
	@echo "=== Generating Proto files ==="
	@./scripts/proto_gen.sh
	@echo ""
	@echo "=== Generating Swagger documentation ==="
	@./scripts/gateway-gen.sh
	@echo ""
	@echo "=== Generating TypeScript client ==="
	@./scripts/ts-client-gen.sh
	@echo ""
	@echo "Code generation complete!"

# Build all services
build:
	@echo "Building all services..."
	@echo ""
	@echo "=== Building API Gateway ==="
	cd api-gateway && go build -o main
	@echo ""
	@echo "=== Building Meal Service ==="
	cd meal-service && go build -o main
	@echo ""
	@echo "=== Building Logging Service ==="
	cd logging-service && go build -o main
	@echo ""
	@echo "=== Building Agent Service ==="
	cd agent-service && yarn build
	@echo ""
	@echo "=== Building MCP Service ==="
	cd mcp-service && yarn build
	@echo ""
	@echo "=== Building UI ==="
	cd ui && yarn build
	@echo ""
	@echo "Build complete!"

# Run all tests
test:
	@echo "Running all tests..."
	@echo ""
	@echo "=== Testing API Gateway ==="
	cd api-gateway && go test ./... -v
	@echo ""
	@echo "=== Testing Meal Service ==="
	cd meal-service && go test ./... -v
	@echo ""
	@echo "=== Testing Logging Service ==="
	cd logging-service && go test ./... -v
	@echo ""
	@echo "=== Testing Agent Service ==="
	cd agent-service && yarn test
	@echo ""
	@echo "=== Testing MCP Service ==="
	cd mcp-service && yarn test
	@echo ""
	@echo "=== Testing UI ==="
	cd ui && yarn test
	@echo ""
	@echo "All tests complete!"

# Clean generated files and build artifacts
clean:
	@echo "Cleaning generated files and build artifacts..."
	@echo ""
	@echo "=== Cleaning Go services ==="
	rm -f api-gateway/main
	rm -f meal-service/main
	rm -f logging-service/main
	rm -f api-gateway/tmp/main
	rm -f meal-service/tmp/main
	rm -f logging-service/tmp/main
	@echo ""
	@echo "=== Cleaning Node.js services ==="
	rm -rf agent-service/dist
	rm -rf mcp-service/dist
	rm -rf ui/build
	@echo ""
	@echo "=== Cleaning generated code ==="
	# Note: Be careful about cleaning generated files that might be committed
	# Only clean files that are truly generated and not tracked in git
	@echo ""
	@echo "Clean complete!"

# Install development dependencies
install-deps:
	@echo "Installing development dependencies..."
	@echo ""
	@echo "=== Installing Go tools ==="
	go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
	go install github.com/swaggo/swag/cmd/swag@latest
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	@echo ""
	@echo "=== Installing Node.js dependencies ==="
	yarn install
	@echo ""
	@echo "Dependencies installed!"

# Quick check - runs lint and tests without building
check: lint test
	@echo "Quick check complete!"

# Full CI pipeline - lint, generate, build, test
ci: lint generate build test
	@echo "CI pipeline complete!"