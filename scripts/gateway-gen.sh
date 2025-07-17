#!/usr/bin/env bash

set -e
export PATH="$PATH:$(go env GOPATH)/bin"

echo "=== Generating OpenAPI documentation for API Gateway ==="

# Navigate to api-gateway directory
cd api-gateway

# Generate swagger documentation
echo "Generating Swagger documentation..."
swag init --parseDependency --parseInternal

# Check if swagger.json was generated
if [ ! -f "docs/swagger.json" ]; then
    echo "ERROR: swagger.json not found. Swag init may have failed."
    exit 1
fi

echo "Swagger documentation generated successfully at api-gateway/docs/swagger.json"

# Navigate back to project root
cd ..

echo "=== OpenAPI generation complete ==="