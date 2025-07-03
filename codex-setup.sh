#!/usr/bin/env bash
set -euo pipefail

export CODEX_ENV_PYTHON_VERSION=3.13
export CODEX_ENV_NODE_VERSION=22
export CODEX_ENV_GO_VERSION=1.23
# --- Project–specific dependencies ----------------------------
yarn install
pushd typescript
yarn install
popd

pushd go
go mod download
# Also download dependencies for api-gateway
pushd api-gateway
go mod download
popd
popd