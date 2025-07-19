#!/usr/bin/env bash

set -e
export PATH="$PATH:$HOME/go/bin:$(pwd)/.yarn/.bin:$(pwd)/node_modules/.bin"

# Go - API proto
echo "=== Generating Go code for API proto ==="
protoc -I=proto proto/api.proto \
  --go_out=./generated/go --go_opt=paths=source_relative \
  --go-grpc_out=./generated/go --go-grpc_opt=paths=source_relative

# Go - Agent proto
echo "=== Generating Go code for Agent proto ==="
protoc -I=proto proto/agent.proto \
  --go_out=./generated/go/agent --go_opt=paths=source_relative \
  --go-grpc_out=./generated/go/agent --go-grpc_opt=paths=source_relative

# Connect-ES (messages + client/server stubs)
echo "=== Generating Connect-ES code ==="
protoc -I=proto proto/*.proto \
  --es_out=target=ts:./generated/ts

# Connect client/server stubs
echo "=== Generating Connect client/server stubs ==="
protoc -I=proto proto/*.proto \
  --connect-es_out=target=ts:./generated/ts
  
pushd ./generated/ts
    rm -rf ./gateway/dist
    npx tsc --outDir ./gateway/dist
popd
