#!/usr/bin/env bash

set -e
export PATH=$PATH:$HOME/go/bin && protoc -I=proto proto/*.proto --go_out=./generated/go --go_opt=paths=source_relative --go-grpc_out=./generated/go --go-grpc_opt=paths=source_relative --plugin=./node_modules/ts-proto/protoc-gen-ts_proto --ts_proto_out=./generated/ts

pushd ./generated/ts
    npx tsc 
popd
