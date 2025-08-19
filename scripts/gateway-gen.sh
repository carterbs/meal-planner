#!/usr/bin/env bash

set -e
export PATH="$PATH:$(go env GOPATH)/bin"

echo "=== Generating OpenAPI documentation for API Gateway ==="

# Navigate to api-gateway directory
cd api-gateway

# Generate swagger documentation
echo "Generating Swagger documentation..."
swag init --parseDependency --parseInternal --propertyStrategy camelcase

# Check if swagger.json was generated
if [ ! -f "docs/swagger.json" ]; then
    echo "ERROR: swagger.json not found. Swag init may have failed."
    exit 1
fi

echo "Swagger documentation generated successfully at api-gateway/docs/swagger.json"

# Navigate back to project root
cd ..

# Transform snake_case to camelCase in swagger.json
echo "Transforming property names from snake_case to camelCase..."
go run tools/swagger-transform/main.go \
  -input api-gateway/docs/swagger.json \
  -output api-gateway/docs/swagger.json

# Fix missing protobuf fields (especially timestamps)
echo "Fixing missing protobuf fields in swagger.json..."
go run tools/swagger-fix/main.go \
  -input api-gateway/docs/swagger.json \
  -output api-gateway/docs/swagger.json \
  -proto-dir proto

echo "=== OpenAPI generation complete ==="