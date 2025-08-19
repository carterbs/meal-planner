#!/bin/bash

set -e
export PATH="$PATH:$HOME/go/bin:$(pwd)/.yarn/.bin"

./scripts/proto_gen.sh
./scripts/gateway-gen.sh
./scripts/ts-client-gen.sh

# Validate swagger completeness
echo "=== Validating Swagger Completeness ==="
cd api-gateway
echo "Running swagger validation test..."
go test -v ./swagger_validation_test.go
if [ $? -ne 0 ]; then
    echo "❌ SWAGGER VALIDATION FAILED: Missing protobuf fields detected"
    echo "This means swagger.json is missing fields from proto definitions."
    echo "Check the test output above for specific missing fields."
    echo "Build failed to ensure API completeness."
    exit 1
fi
echo "✅ Swagger validation passed - all protobuf fields are present"
cd ..
