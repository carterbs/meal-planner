#!/usr/bin/env bash

set -e
export PATH="$PATH:$(go env GOPATH)/bin"

echo "=== Generating TypeScript client from OpenAPI spec ==="

# First, generate the OpenAPI spec
echo "Generating OpenAPI spec..."
./scripts/gateway-gen.sh

# Check if swagger.json exists
if [ ! -f "api-gateway/docs/swagger.json" ]; then
    echo "ERROR: swagger.json not found. Cannot generate TypeScript client."
    exit 1
fi

# Generate TypeScript client
echo "Generating TypeScript client..."
npx @hey-api/openapi-ts -i api-gateway/docs/swagger.json -o generated/ts/gateway

# Check if the client was generated
if [ ! -f "generated/ts/gateway/index.ts" ]; then
    echo "ERROR: TypeScript client generation failed."
    exit 1
fi

echo "TypeScript client generated successfully at generated/ts/gateway/"

# Fix the import path in client.gen.ts
echo "Fixing import paths in generated client..."
sed -i '' "s|from './client';|from './client/index';|g" generated/ts/gateway/client.gen.ts

# Compile TypeScript to JavaScript
echo "Compiling TypeScript to JavaScript..."
pushd generated/ts/gateway
    npx tsc --outDir dist
popd

echo "JavaScript client compiled successfully at generated/ts/gateway/dist/"
echo "=== TypeScript client generation complete ==="