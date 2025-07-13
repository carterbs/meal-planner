#!/usr/bin/env bash

set -e
export PATH="$PATH:$HOME/go/bin:$(pwd)/.yarn/.bin"

# Go
protoc -I=proto proto/*.proto \
  --go_out=./generated/go --go_opt=paths=source_relative \
  --go-grpc_out=./generated/go --go-grpc_opt=paths=source_relative

# Connect-ES (messages + client/server stubs)
protoc -I=proto proto/*.proto \
  --es_out=target=ts:./generated/ts

# Connect client/server stubs
protoc -I=proto proto/*.proto \
  --connect-es_out=target=ts:./generated/ts
  
pushd ./generated/ts
    npx tsc 
popd
